# app-spec.md — NestJS Backend Supplement Specification

This file is a **sibling to `openapi.json`** and covers everything that cannot be expressed in OpenAPI: architectural decisions, business rules, pipeline internals, inter-service contracts, data model design, and deployment constraints.

`openapi.json` is the sole truth for endpoint paths, HTTP methods, request/response shapes, and status codes. This file explains *why* and *how*.

---

## 1. Technology Stack

| Concern | Choice |
|---|---|
| Runtime | NestJS 11, TypeScript |
| ORM | Prisma 6 (`@prisma/client`) |
| Database | PostgreSQL via Neon (serverless free tier) |
| Auth model | Frontend Auth.js v5 owns OAuth. Backend validates Auth.js-issued JWTs only. |
| Auth providers | Google OAuth 2.0, Kakao OAuth 2.0 |
| File ingestion | `multipart/form-data` upload directly to NestJS backend |
| NLP | FastAPI microservice (internal, Cloud Run) — called over HTTP by NestJS |
| LLM | Gemini API via `@google/genai` npm SDK, model `gemini-2.5-flash` |
| Background jobs | Google Cloud Tasks — HTTP task queue targeting `POST /job/execute` on this service |
| Deployment | Google Cloud Run (scale-to-zero) for both NestJS backend and FastAPI NLP service |
| Package manager | `pnpm` |
| Test framework | `vitest` |

---

## 2. Authentication & User Management

### Flow

Auth.js (frontend) owns all OAuth flows. The backend is never involved in OAuth redirects or token exchange.

```
1. User completes OAuth on frontend (Google or Kakao)
2. Auth.js jwt() callback fires once → POST /auth/sync { provider, providerAccountId, email?, name?, image? }
3. Backend upserts User record, returns User shape
4. Auth.js stores backend user.id as `sub` in its signed JWT
5. All subsequent API calls: Authorization: Bearer <authjs-jwt>
6. JwtAuthGuard verifies token using JWT_SECRET (== AUTH_SECRET on frontend), reads sub as userId
```

### JWT Validation

- Use `@nestjs/jwt` `JwtService.verify()` directly — no Passport.
- `JwtAuthGuard` is a plain `CanActivate`. Throws `UnauthorizedException` on invalid or missing token.
- Endpoints **exempt** from JWT guard: `POST /auth/sync`, `GET /health`.
- `POST /job/execute` is **not** JWT-protected — uses `X-CloudTasks-Secret` header instead (see §7).
- All other endpoints require JWT. This is enforced globally; exemptions are explicitly decorated.

### Answer to Q4: Is authentication sufficient to protect private resources?

**Yes, with one required implementation rule:** the global `security: [{ bearer: [] }]` in openapi.json declares all endpoints JWT-protected by default. The two exempt endpoints (`/auth/sync`, `/health`) must be decorated with `@Public()` (a custom decorator that sets metadata to skip `JwtAuthGuard`). As long as:

1. `JwtAuthGuard` is applied **globally** in `AppModule` (via `APP_GUARD`), and
2. Every exempt endpoint carries `@Public()`, and
3. Every resource fetch/mutate performs an **ownership check** against `currentUser.id` (not just authentication),

...then private resources are fully protected. Authentication alone is not enough — **authorization** (ownership check) is the second layer and must be applied at the service level for every content/group operation. The ownership check rules are specified in §10.

### User Upsert Key

Composite unique: `(provider, providerAccountId)`. Never upsert by email — Kakao users may lack email without Biz App verification.

### Kakao Notes

- Email is null if Kakao app lacks Biz App verification. `User.email` is nullable.
- Default Kakao scopes provide `profile_nickname` and `profile_image` only.

### Default Group Provisioning

When a new `User` record is created (first-time `POST /auth/sync`), the backend must **atomically** create a default `Group` for that user in the same transaction:

```
prisma.$transaction([
  prisma.user.upsert(...),
  prisma.group.create({ data: { name: 'Default', isDefault: true, userId } })
])
```

The default group is only created on first upsert (when the user row does not yet exist). Subsequent syncs must not create a second default group.

---

## 3. Data Model

### Prisma Schema (authoritative)

```prisma
enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model User {
  id                String    @id @default(uuid())
  provider          String
  providerAccountId String
  email             String?
  name              String?
  avatarUrl         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  jobs              Job[]
  groups            Group[]

  @@unique([provider, providerAccountId])
}

model Group {
  id        String    @id @default(uuid())
  name      String
  isDefault Boolean   @default(false)
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  contents  Content[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Job {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  status    JobStatus @default(PENDING)
  progress  Int       @default(0)
  error     String?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  content   Content?
}

model Content {
  id        String   @id @default(uuid())
  jobId     String   @unique
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  groupId   String
  group     Group    @relation(fields: [groupId], references: [id])
  userId    String
  inputText String
  title     String
  data      Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model GrammarPattern {
  id               String    @id @default(uuid())
  nlpLibraryId     String    @unique  // opaque stable ID from NLP microservice — cache key
  name             String              // human-readable, e.g. 〜てしまう
  description      String?
  exampleSentences Json               // Array<{ japanese: string, translation: string }>
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

### Design Notes

- `Content.userId` is denormalized. Ownership checks on `GET /content/:id`, `PATCH /content/:id`, and `DELETE /content/:id` use it directly without a `Job` join.
- `Content.groupId` is non-nullable. Every content item always belongs to exactly one group.
- `Job` → `Content`: deleting a `Content` record cascades to delete its `Job`. `DELETE /content/:id` removes both atomically.
- `GrammarPattern.nlpLibraryId` is the cache key for AI-generated example sentences. Its format is opaque — the NLP microservice is responsible for providing a stable, consistent ID per grammar pattern.
- `Group.isDefault` marks the system default group per user. It is created once on first user sync and cannot be deleted.

---

## 4. Groups

### Semantics

Groups are **strictly organizational** — UI folders for user content. They have no effect on content processing, JLPT level evaluation, or any pipeline logic.

### Ownership

Groups are privately owned by a single user. A user can only see and manage their own groups. No sharing between users.

### Default Group

- Created automatically when the user account is first created (see §2).
- `isDefault: true` — cannot be deleted, cannot be renamed (enforce in service layer).
- `GET /groups` always returns the default group; it appears first in the list.
- All group-to-content reassignment on group deletion targets this group.

### Group Deletion

`DELETE /groups/:groupId`:

1. Assert `group.userId === currentUser.id` — 404 if not found or foreign.
2. Assert `group.isDefault === false` — 400 if attempting to delete default group. Response: `{ detail: "Cannot delete the default group." }`.
3. Reassign all contents in the deleted group to the user's default group in a single `prisma.content.updateMany({ where: { groupId }, data: { groupId: defaultGroup.id } })`.
4. Delete the group.
5. Steps 3–4 must be wrapped in a `prisma.$transaction`.

### API Rules

- `GET /groups` — returns all groups belonging to `currentUser.id`. Default group is always first.
- `POST /groups` — creates a group with `isDefault: false` owned by `currentUser.id`.
- `GET /groups/:groupId` — returns group only if `group.userId === currentUser.id`. 404 otherwise (do not leak existence).
- `DELETE /groups/:groupId` — see deletion flow above.
- `GET /groups/:groupId/content` — validates group ownership first, then returns paginated content.

---

## 5. Content Ingestion — POST /content

### Request Format

`multipart/form-data` with the following fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | yes | Display title for the content item |
| `group` | uuid string | yes | ID of an existing group owned by the current user |
| `text` | string | one of text/file | Raw Japanese text pasted by user |
| `file` | binary | one of text/file | Uploaded file (PDF or .txt) |

**Business rule — mutual exclusivity:** exactly one of `text` or `file` must be present.
- Both absent → `400 Bad Request`: `{ detail: "Either text or file must be provided." }`
- Both present → `400 Bad Request`: `{ detail: "Provide either text or file, not both." }`

### File Handling

Accepted MIME types / extensions:
- `application/pdf` / `.pdf` — extract text via `pdf-parse` npm package
- `text/plain` / `.txt` — read buffer as UTF-8 string directly

Unsupported type → `400`: `{ detail: "Unsupported file type. Only PDF and .txt are accepted." }`

File size limit: `10MB`. Enforced by NestJS `FileSizeValidator`. Matches `NEXT_PUBLIC_MAX_FILE_SIZE_MB=10` on frontend.

After extraction, raw Japanese text is stored as `Content.inputText`. The original file binary is **not persisted**.

### Group Validation

Before creating the Content record:
1. Fetch the group by the provided `group` UUID.
2. If not found → `400 Bad Request`: `{ detail: "Invalid group." }` — do not reveal existence (use 400 not 404 to avoid leaking other users' group IDs).
3. If `group.userId !== currentUser.id` → `400 Bad Request`: same message as above.

### PATCH /content/:id — Move to Group

Same group ownership validation applies. Target `groupId` must exist and belong to `currentUser.id` → 400 on violation.

### Response

Returns `202 ProcessingContent` immediately after job is enqueued.

---

## 6. Content Ownership & Access Control

All content, jobs, and groups are **strictly private** to the owning user.

| Endpoint | Auth | Ownership rule |
|---|---|---|
| `GET /groups` | JWT | Filter by `userId` from JWT |
| `POST /groups` | JWT | Assign `userId` from JWT |
| `GET /groups/:groupId` | JWT | 404 if `group.userId !== currentUser.id` |
| `DELETE /groups/:groupId` | JWT | 404 if foreign, 400 if default |
| `GET /groups/:groupId/content` | JWT | 404 if `group.userId !== currentUser.id` |
| `POST /content` | JWT | Validate group ownership before creating |
| `GET /content/:id` | JWT | 404 if not found; 403 if `content.userId !== currentUser.id` |
| `PATCH /content/:id` | JWT | 403 on ownership mismatch; 400 on invalid target group |
| `DELETE /content/:id` | JWT | 403 on ownership mismatch; 404 if not found |

**Note on 403 vs 404:** For `GET /content/:id` and `DELETE /content/:id`, return 404 if the record does not exist, and 403 if it exists but belongs to another user. This is intentional — 404 on foreign content would obscure whether the resource exists at all, but since content IDs are UUIDs and not guessable, 403 is acceptable here and aids debugging. For groups, always 404 regardless (group IDs could theoretically be leaked via content responses).

---

## 7. Async Pipeline

### Architecture Rationale

Cloud Run freezes CPU when no request is being handled. In-process fire-and-forget (`Promise` without `await`) is unreliable in production — the runtime may be frozen before the async work completes. Google Cloud Tasks enqueues an HTTP task that Cloud Run handles as a fresh inbound request with full CPU allocation for the duration.

### POST /content Flow (user-facing)

```
1. Extract text from file if applicable
2. Validate group ownership
3. prisma.$transaction:
     content = prisma.content.create({ userId, groupId, inputText, title, data: null })
     job = prisma.job.create({ userId, status: PENDING, progress: 0, contentId: content.id })
4. Enqueue HTTP task to Cloud Tasks:
     POST {CLOUD_TASKS_WORKER_URL}/job/execute
     Body: { jobId: job.id }
     Header: X-CloudTasks-Secret: {CLOUD_TASKS_SECRET}
     Max retries: 3, exponential backoff
5. Return 202 ProcessingContent
```

### POST /job/execute (Cloud Tasks worker — internal)

**Not JWT-protected.** Protected by `X-CloudTasks-Secret` header validated against `CLOUD_TASKS_SECRET` env var. Invalid or missing secret → `401`. Returns `200` on success, `500` on failure (triggers Cloud Tasks retry).

**Idempotency guard:** On entry, fetch `job.status`. If already `COMPLETED` or `FAILED` → return `200` immediately without reprocessing. This safely handles Cloud Tasks retries.

**Retry policy:** Max 3 attempts, exponential backoff. After 3 failures, Cloud Tasks stops. The stuck-job cron (§7) cleans up any remaining `PROCESSING` jobs.

### Pipeline Phases

```
Entry:   Idempotency check (COMPLETED/FAILED → 200 early return)
         prisma.job.update({ status: PROCESSING, progress: 0 })

Phase 1 (16%):
         NlpService.segment(inputText) → sentences: string[]
         prisma.job.update({ progress: 16, current_step: "Segmenting article" })

Phase 2 (33%):
         NlpService.analyze(sentences) → AnalysisResult[]
           (vocab hits + grammar pattern hits per sentence, in one call)
         prisma.job.update({ progress: 33, current_step: "Analyzing vocabulary and grammar" })

Phase 3 (66%):
         For each unique grammar pattern across all sentences:
           - Lookup GrammarPattern by nlpLibraryId (DB cache)
           - Cache hit → use persisted exampleSentences
           - Cache miss → LlmService.generateExamples(pattern) → persist to GrammarPattern table
         Split sentences into LLM_BATCH_SIZE chunks
         Promise.all(batches.map(batch => LlmService.analyzeBatch(batch, analysisResults)))
           → per sentence: translation, level, similar_patterns[]
         prisma.job.update({ progress: 66, current_step: "Generating translations and examples" })

Phase 4 (83%):
         Aggregate per-sentence levels → overall_level + level_distribution
         Assemble CompletedContent shape (per openapi.json schemas)
         prisma.job.update({ progress: 83, current_step: "Assembling study material" })

Phase 5 (100%):
         prisma.content.update({ data: assembledResult })
         prisma.job.update({ status: COMPLETED, progress: 100, current_step: null })
```

On any unhandled error at any phase:
```
prisma.job.update({ status: FAILED, error: err.message })
return 500  ← triggers Cloud Tasks retry if attempts remain
```

### Stuck-Job Cron

`@Cron('0 * * * *')` — runs every hour. Finds all jobs where `status = PROCESSING` and `updatedAt < now() - 10 minutes`. Sets them to `FAILED` with `error: 'Job timed out'`. Catches jobs whose Cloud Tasks retries were exhausted without explicit FAILED marking.

---

## 8. NLP Microservice Contract

NestJS calls the FastAPI NLP service over HTTP using `HttpService` from `@nestjs/axios`. Base URL: `NLP_SERVICE_URL` env var. HTTP timeout: 30s.

### Assumed Endpoints

The NLP microservice library is not yet decided. The following endpoint contract is designed to optimally serve the NestJS pipeline. The microservice implementation must conform to this contract.

---

#### POST /segment

Decomposes a Japanese article into unit sentences.

**Request:**
```json
{ "text": "string" }
```

**Response:**
```json
{ "sentences": ["string"] }
```

**Contract:** Each element in `sentences` represents 1–3 real Japanese sentences grouped as a study unit. Units should not be too short (avoid single-clause fragments). Segmentation logic is fully owned by the microservice.

---

#### POST /analyze

Returns per-sentence vocabulary and grammar analysis in a single call. Replaces the previously considered separate `/vocab` and `/grammar` calls — combining them avoids double tokenization and is more efficient.

**Request:**
```json
{ "sentences": ["string"] }
```

**Response:**
```json
{
  "results": [
    {
      "vocab_hits": [
        {
          "word": "string",
          "reading": "string",
          "meaning": "string",
          "level": "N1 | N2 | N3 | N4 | N5 | null",
          "synonyms": ["string"],
          "example_phrases": ["string"]
        }
      ],
      "grammar_hits": [
        {
          "nlp_library_id": "string",
          "name": "string",
          "description": "string"
        }
      ]
    }
  ]
}
```

**Contract:**
- `results[i]` corresponds to `sentences[i]` — array lengths must match.
- `vocab_hits[].level` may be null if the library cannot determine the JLPT level for a word.
- `grammar_hits[].nlp_library_id` must be **stable across calls** for the same grammar pattern — it is used as the cache key in the `GrammarPattern` table. If the underlying library does not provide a stable ID, the microservice must derive one (e.g. normalize the pattern name).
- `grammar_hits[].synonyms` and `example_phrases` on vocab: if the NLP library provides them, include them. If not, return empty arrays — the LLM fill in synonyms via the batch analysis call.

---

### NestJS-side DTO Types (inferred from contract above)

```typescript
// NlpSegmentResponseDto
interface NlpSegmentResponse {
  sentences: string[];
}

// NlpAnalyzeResponseDto
interface NlpVocabHit {
  word: string;
  reading: string;
  meaning: string;
  level: 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | null;
  synonyms: string[];
  example_phrases: string[];
}

interface NlpGrammarHit {
  nlp_library_id: string;
  name: string;
  description: string;
}

interface NlpSentenceAnalysis {
  vocab_hits: NlpVocabHit[];
  grammar_hits: NlpGrammarHit[];
}

interface NlpAnalyzeResponse {
  results: NlpSentenceAnalysis[];
}
```

---

## 9. Gemini Integration (LlmService)

Package: `@google/genai` (NOT `@google/generative-ai`).
Model: `gemini-2.5-flash`.

### Call Type 1 — Batch Sentence Analysis

Called in Phase 3. Input per batch: array of sentences (up to `LLM_BATCH_SIZE`) with their NLP analysis results.

Prompt provides per sentence: the raw Japanese text, vocab hits (word, reading, meaning, level), grammar hit names and descriptions.

**Output per sentence:**
```typescript
{
  translation: string        // English translation of the sentence
  level: JLPTLevel           // N1–N5 classification for this sentence
  similar_patterns: string[] // related grammar pattern names worth noting
}
```

The `grammar_points` field in the final `Sentence` response shape is populated from `grammar_hits[].name` (from NLP service) — not from Gemini. Gemini only adds `similar_patterns` and `translation` and sentence-level `level`.

### Call Type 2 — Grammar Example Generation

Called in Phase 3 only on cache miss (no existing `GrammarPattern` row for the `nlp_library_id`).

Input: grammar pattern name + description.

**Output:**
```typescript
{
  examples: Array<{
    japanese: string
    translation: string
  }>
}
```

Generate 3–5 examples per pattern. Persist immediately to `GrammarPattern` table before proceeding. All future pipeline runs reuse cached examples — no redundant Gemini calls for the same grammar pattern.

### Batching Rules

- Batch size: `LLM_BATCH_SIZE` env var (default `5`).
- Fire all sentence batches concurrently via `Promise.all`.
- Never call Gemini once per sentence.
- Never send all sentences in one call (token limit risk).

### Structured Output Pattern

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: { /* JSON Schema matching the Zod schema */ },
  },
});
const raw = JSON.parse(response.text);
const validated = MyZodSchema.parse(raw); // Zod as safety net — throws ZodError on violation
```

---

## 10. CompletedContent Assembly

The final `data` JSON stored in `Content.data` and returned by `GET /content/:id` for COMPLETED content:

```typescript
{
  overall_level: JLPTLevel           // most frequent per-sentence level (or highest if tie)
  level_distribution: {              // percentage of sentences at each level (sums to 100)
    N1: number, N2: number, N3: number, N4: number, N5: number
  }
  sentences: Array<{
    text: string
    translation: string              // from Gemini
    level: JLPTLevel                 // from Gemini
    grammar_points: Array<{
      name: string                   // from NLP grammar_hits[].name
      description: string            // from NLP grammar_hits[].description
      examples: Array<{ japanese: string, translation: string }> // from GrammarPattern cache or Gemini
    }>
    similar_patterns: string[]       // from Gemini
  }>
  vocabulary: Array<{                // deduplicated union across all sentences
    word: string
    reading: string
    level: JLPTLevel                 // from NLP vocab_hits[].level (null → omit or mark unknown)
    translation: string              // from NLP vocab_hits[].meaning
    synonyms: string[]               // from NLP if provided, else []
    example_phrases: string[]        // from NLP if provided, else []
  }>
}
```

Deduplication of `vocabulary`: if the same `word` appears in multiple sentences, include it once. Merge `synonyms` and `example_phrases` arrays (union, deduplicated).

---

## 11. Response Shapes for Intermediate States

`GET /content/:id` maps `Job` fields onto the response:

| Job status | Response type | Extra fields sourced from |
|---|---|---|
| PENDING | ProcessingContent | `progress: job.progress` (0), `current_step: null` |
| PROCESSING | ProcessingContent | `progress: job.progress`, `current_step: job.current_step` |
| FAILED | FailedContent | `error_message: job.error` |
| COMPLETED | CompletedContent | `content.data` (fully assembled JSON) |

`current_step` is stored on `Job` as a `String?` field (add to Prisma schema). Updated alongside `progress` at each pipeline phase.

Add to Prisma `Job` model:
```prisma
current_step String?   // human-readable pipeline phase label
```

---

## 12. Error Response Shape

All error responses conform to `{ detail: string }` — enforced by a global `HttpExceptionFilter` that maps all `HttpException` subclasses (and unknown errors → 500) to this shape. This is the `ApiError` schema in openapi.json.

---

## 13. Pagination

`GET /groups/:groupId/content` is paginated.

Query params: `page` (default 1), `limit` (default 10).
Response envelope: `{ data: Content[], meta: { total, page, limit } }`.

Implementation: `prisma.findMany({ skip: (page-1)*limit, take: limit })` paired with `prisma.count()` in a `$transaction`.

---

## 14. Environment Variables

```bash
# Server
PORT=8000
FRONTEND_URL=http://localhost:3000

# Auth
JWT_SECRET=changeme                        # must equal AUTH_SECRET on Next.js frontend

# Database
DATABASE_URL=postgresql://...              # Neon serverless PostgreSQL connection string

# NLP Microservice
NLP_SERVICE_URL=http://localhost:8001      # FastAPI NLP service base URL

# Gemini
GEMINI_API_KEY=                            # from aistudio.google.com/apikey

# Pipeline
LLM_BATCH_SIZE=5                           # sentences per Gemini batch call
CLOUD_TASKS_QUEUE_NAME=pipeline-queue      # GCP Cloud Tasks queue name
CLOUD_TASKS_WORKER_URL=                    # full public URL of POST /job/execute on this service
CLOUD_TASKS_SECRET=                        # shared secret for X-CloudTasks-Secret header validation
```

All env vars accessed via injected `ConfigService`. Never use `process.env` directly.

---

## 15. Module Structure

```
src/
  modules/
    auth/
      auth.module.ts
      auth.controller.ts          → POST /auth/sync, GET /auth/me
      auth.service.ts             → syncUser() upsert + default group creation, getMe()
      dto/sync-user.dto.ts
      guards/jwt-auth.guard.ts    → JwtAuthGuard (CanActivate, applied globally via APP_GUARD)
      decorators/
        current-user.decorator.ts → @CurrentUser()
        public.decorator.ts       → @Public() (skips JwtAuthGuard)
    content/
      content.module.ts
      content.controller.ts       → POST /content, GET /content/:id, PATCH /content/:id, DELETE /content/:id
      content.service.ts
      dto/create-content.dto.ts
    group/
      group.module.ts
      group.controller.ts         → GET /groups, POST /groups, GET /groups/:groupId,
                                     DELETE /groups/:groupId,
                                     GET /groups/:groupId/content
      group.service.ts
      dto/create-group.dto.ts
    job/
      job.module.ts
      job.controller.ts           → POST /job/execute (Cloud Tasks worker, internal)
      job.service.ts              → executeJob() pipeline runner
      job.cron.ts                 → stuck-job cleanup @Cron('0 * * * *')
    llm/
      llm.module.ts
      llm.service.ts              → analyzeBatch(), generateExamples()
    nlp/
      nlp.module.ts
      nlp.service.ts              → segment(), analyze() via HttpService
  common/
    prisma/
      prisma.module.ts            → global PrismaModule
      prisma.service.ts           → PrismaService extends PrismaClient
    filters/
      http-exception.filter.ts    → GlobalExceptionFilter → { detail: string }
    config/
      configuration.ts            → typed config factory
  app.module.ts
  main.ts
```

---

## 16. Deployment

| Service | Platform | Notes |
|---|---|---|
| NestJS backend | Cloud Run | Handles user-facing API + Cloud Tasks worker endpoint |
| FastAPI NLP service | Cloud Run (scale-to-zero) | Internal only — called only by NestJS |
| PostgreSQL | Neon serverless | Free tier |
| Job queue | Google Cloud Tasks | Max 3 retries, exponential backoff |

NLP service cold starts (~1–2s) are acceptable — NestJS calls it from the async pipeline worker, not user-facing request handlers.

---

## 17. Pending / Deferred Decisions

| Item | Status |
|---|---|
| NLP library choice for microservice | ❌ Not decided. Microservice must conform to the `/segment` and `/analyze` contract in §8. |
| SSE (`GET /content/stream`) | ⏸ Postponed to future worktree. Endpoint intentionally omitted from openapi.json for now. |
| `GrammarPattern` example count | Recommend 3–5 per pattern. Confirm if more is needed. |
