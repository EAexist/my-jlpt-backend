# CLAUDE.md — my-jlpt/backend

NestJS REST API server. Validates Auth.js-issued JWTs, syncs user records, dispatches background jobs via Google Cloud Tasks, calls the FastAPI NLP microservice and Gemini LLM, and persists results to PostgreSQL via Prisma.

API contract source of truth: `../docs/openapi.yaml`. All endpoint paths, request shapes, and response shapes must match it exactly.

---

## Package Manager

`pnpm`

---

## Key Dependencies (package.json)

```
@nestjs/common / core / platform-express  ^11
@nestjs/config       ^4    → ConfigService, ConfigModule.forRoot({ isGlobal: true })
@nestjs/jwt          ^11   → JwtModule (JWT validation only — no Passport)
@nestjs/schedule     ^5    → ScheduleModule (stuck-job cron)
@nestjs/axios        —     → HttpModule, HttpService (NLP HTTP calls) — ADD THIS
@prisma/client       ^6
class-validator / class-transformer       → ValidationPipe
rxjs                 ^7
@google/genai        —     → manually added (NOT @google/generative-ai)
```

`@nestjs/axios` is not in `package.json` yet — add it when implementing `NlpModule`.
`@google/genai` is not in `package.json` yet — add it manually before implementing `LlmModule`.

---

## Environment Variables

```bash
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://...              # Neon serverless PostgreSQL
JWT_SECRET=changeme                        # must equal AUTH_SECRET on the Next.js frontend
GEMINI_API_KEY=                            # from aistudio.google.com/apikey
NLP_SERVICE_URL=http://localhost:8001      # FastAPI NLP microservice base URL
LLM_BATCH_SIZE=5                           # sentences per Gemini batch call (default 5)
CLOUD_TASKS_QUEUE_NAME=pipeline-queue      # GCP Cloud Tasks queue name
CLOUD_TASKS_WORKER_URL=                    # full public URL of POST /job/execute on this service
PORT=8000
```

All env vars must be accessed via injected `ConfigService`, never `process.env` directly.

---

## Directory Structure

```
src/
  modules/
    auth/
      auth.module.ts
      auth.controller.ts   → POST /auth/sync, GET /auth/me
      auth.service.ts      → syncUser() upsert, getMe()
      dto/
        sync-user.dto.ts   → SyncUserDto
      guards/
        jwt-auth.guard.ts  → JwtAuthGuard (CanActivate, uses JwtService.verify)
      decorators/
        current-user.decorator.ts  → @CurrentUser()
    content/
      content.module.ts
      content.controller.ts  → POST /content, GET /content, GET /content/:id, DELETE /content/:id
      content.service.ts     → createContent(), listContent(), getContent(), deleteContent()
      dto/
        create-content.dto.ts
    job/
      job.module.ts
      job.controller.ts    → POST /job/execute (Cloud Tasks worker, internal)
      job.service.ts       → executeJob() pipeline runner
      job.cron.ts          → stuck-job cleanup @Cron
    llm/
      llm.module.ts
      llm.service.ts       → GeminiService: structured batch calls
    nlp/
      nlp.module.ts
      nlp.service.ts       → NlpService: HTTP calls to FastAPI via HttpService
  common/
    prisma/
      prisma.module.ts     → global PrismaModule
      prisma.service.ts    → PrismaService (OnModuleInit, OnModuleDestroy)
    filters/
      http-exception.filter.ts  → GlobalExceptionFilter → { detail: string }
    config/
      configuration.ts     → typed config factory
  app.module.ts
  main.ts
prisma/
  schema.prisma
docs/
  auth-spec.md
  background-pipeline-spec.md
```

---

## main.ts Bootstrap

```typescript
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
app.useGlobalFilters(new HttpExceptionFilter());
app.enableCors({ origin: configService.get('FRONTEND_URL') });
app.enableShutdownHooks();
await app.listen(configService.get('PORT') ?? 8000);
```

No global route prefix.

---

## Prisma Schema

```prisma
enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

model User {
  id                String   @id @default(uuid())
  provider          String
  providerAccountId String
  email             String?           // nullable — Kakao may lack email
  name              String
  avatarUrl         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  jobs              Job[]

  @@unique([provider, providerAccountId])
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
  job       Job      @relation(fields: [jobId], references: [id])
  userId    String                    // denormalized for ownership checks without join
  inputText String
  title     String?
  data      Json?                     // null until job COMPLETED; CompletedContent shape per openapi.yaml
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Note: `Content.userId` is denormalized intentionally — ownership checks on `GET /content/:id` and `DELETE /content/:id` use it directly without a Job join.

---

## Auth

Backend never handles OAuth. Auth.js v5 on the frontend owns all OAuth flows.

**JWT validation flow:**
1. Auth.js completes Google or Kakao OAuth and fires `POST /auth/sync` once after login.
2. Backend upserts the `User` record and returns it. Auth.js stores `user.id` as `sub` in its JWT.
3. All subsequent requests carry `Authorization: Bearer <authjs-jwt>`.
4. `JwtAuthGuard` calls `JwtService.verify(token, { secret })` — no Passport involved.
5. `@CurrentUser()` extracts the user from the request.

**`JwtAuthGuard`** is a plain `CanActivate` using `@nestjs/jwt`'s `JwtService`. It throws `UnauthorizedException` on invalid/missing token, which `HttpExceptionFilter` normalizes to `{ detail: "..." }`.

**`SyncUserDto`:**
```typescript
provider: string           // 'google' | 'kakao'
providerAccountId: string
email?: string | null      // nullable — Kakao without Biz App verification has no email
name?: string
image?: string | null      // stored as avatarUrl in DB
```

Upsert key: `@@unique([provider, providerAccountId])` — NOT email.

---

## Content Ownership & Access Control

Every `Content` record belongs to exactly one user (`Content.userId`). Access is strictly private.

- `GET /content` — filters by `userId` from JWT. Never returns other users' records.
- `GET /content/:id` — after fetch, check `content.userId === currentUser.id`. Throw `ForbiddenException` (403) if mismatch. Throw `NotFoundException` (404) if record does not exist.
- `DELETE /content/:id` — same ownership check before deletion. 403 on mismatch, 404 if not found.
- `POST /job/execute` — protected via `CLOUD_TASKS_SECRET` header (see below). Not user-facing.

---

## Global Exception Filter

All error responses must be `{ detail: string }` per openapi.yaml. A global `HttpExceptionFilter` maps all `HttpException` subclasses (and unknown errors → 500) to this shape.

---

## Async Pipeline (Cloud Tasks)

Cloud Run freezes CPU on request termination — in-process fire-and-forget is not reliable in production.

### POST /content (user-facing, JWT-protected)
1. `prisma.content.create({ userId, inputText, title, data: null })`
2. `prisma.job.create({ userId, status: PENDING, progress: 0, contentId })`
3. Enqueue HTTP task to Cloud Tasks: `POST {CLOUD_TASKS_WORKER_URL}/job/execute { jobId }`
4. Return `202 ProcessingContent`

### POST /job/execute (Cloud Tasks worker — internal only)
Protected by `X-CloudTasks-Secret` header checked against `CLOUD_TASKS_SECRET` env var. Returns `200` on success, `500` on failure (Cloud Tasks retries on non-2xx).

```
Phase 1 (16%):  update job progress=16
Phase 2 (33%):  NlpService.segment(inputText) → sentences[]
                NlpService.vocab(sentences)   → vocabHits[][]
                NlpService.grammar(sentences) → grammarPatterns[][]
                update job progress=33
Phase 3 (66%):  split sentences into LLM_BATCH_SIZE chunks
                Promise.all(batches.map(batch => llmService.analyzeBatch(batch, vocabHits, grammarPatterns)))
                update job progress=66
Phase 4 (83%):  aggregate per-sentence levels → overall_level + level_distribution
                assemble CompletedContent shape
                update job progress=83
Phase 5 (100%): prisma.content.update({ data: result })
                prisma.job.update({ status: COMPLETED, progress: 100 })
```

On any unhandled error: `prisma.job.update({ status: FAILED, error: err.message })`.

**Stuck-job cron** (`@Cron('0 * * * *')`): sets any job with `status = PROCESSING` and `updatedAt < now - 10min` to `FAILED`.

---

## NLP Microservice (NlpService)

Uses `HttpService` from `@nestjs/axios` (registered in `NlpModule` via `HttpModule`).

```
POST {NLP_SERVICE_URL}/segment   { text: string }       → { sentences: string[] }
POST {NLP_SERVICE_URL}/vocab     { sentences: string[] } → { hits: VocabHit[][] }
POST {NLP_SERVICE_URL}/grammar   { sentences: string[] } → { patterns: string[][] }
```

The NLP service runs on Cloud Run with scale-to-zero. Cold starts (~1–2s) are acceptable since calls happen inside the async worker, not in the user-facing request path. Configure a reasonable HTTP timeout in `HttpModule` to prevent the pipeline worker from hanging if the NLP service is unresponsive.

---

## Gemini Integration (LlmService)

Package: `@google/genai` (NOT `@google/generative-ai` — that is the legacy SDK).

```typescript
import { GoogleGenAI } from '@google/genai';

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: { /* JSON Schema matching Zod schema */ },
  },
});
const raw = JSON.parse(response.text);
const validated = MyZodSchema.parse(raw); // Zod safety net
```

Process sentences in batches of `LLM_BATCH_SIZE` (env var, default 5). Fire all batches concurrently via `Promise.all`. Never call Gemini once per sentence. Never send all sentences in a single call (token limit risk).

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | none | Service health check → `{ status: 'ok' }` |
| POST | /auth/sync | none | Upsert user from Auth.js session → `User` |
| GET | /auth/me | JWT | Get current user profile → `User` |
| POST | /content | JWT | Ingest text, enqueue pipeline → `202 ProcessingContent` |
| GET | /content | JWT | List user's content (paginated) → `{ data, meta }` |
| GET | /content/:id | JWT | Get content by status-polymorphic shape → `Content` |
| DELETE | /content/:id | JWT | Delete content → `204` |
| GET | /content/stream | JWT | SSE stream of progress for active jobs (postponed) |
| POST | /job/execute | secret header | Cloud Tasks worker — internal only |

### Response polymorphism for `GET /content/:id` and `GET /content`

Discriminated by `status` field:
- `PENDING` / `PROCESSING` → `ProcessingContent`: includes `progress` (0–99), `current_step?`, `estimated_completion_time?`
- `FAILED` → `FailedContent`: includes `error_message`
- `COMPLETED` → `CompletedContent`: includes `overall_level`, `level_distribution`, `sentences[]`, `vocabulary[]`

### `GET /content` pagination

Query params: `page` (default 1), `limit` (default 10).
Response: `{ data: Content[], meta: { total, page, limit } }`.
Implementation: `prisma.findMany({ where: { userId }, skip: (page-1)*limit, take: limit })` paired with `prisma.count({ where: { userId } })`.

---

## PrismaService

```typescript
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
```

`main.ts` must call `app.enableShutdownHooks()` for clean disconnect on Cloud Run termination.

---

## Config

`ConfigModule.forRoot({ isGlobal: true })` is already in `app.module.ts`. Use a typed config factory at `src/common/config/configuration.ts` returning a validated config object. Inject `ConfigService` into services — never use `process.env` directly.

---

## Testing

Framework: `vitest` (not Jest). Config in `vitest.config.ts`.
- Unit tests: `*.spec.ts` co-located with source
- E2E tests: `test/*.e2e-spec.ts`
- Run: `pnpm test` / `pnpm test:watch` / `pnpm test:cov`
