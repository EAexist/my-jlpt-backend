# backend/CLAUDE.md

> Read root `CLAUDE.md` first. Then read your group in `backend/TASKS.md`.

---

## Scope

NestJS (Node.js). Owns JWT validation, user sync, LLM calls, JLPT data orchestration, background pipeline, and content persistence.
Frontend never touches LLM, NLP service, or DB — all logic lives here.
No Redis, no queue library — background processing is fire-and-forget async.
Backend never handles OAuth — Auth.js on the frontend owns all OAuth flows for Google and Kakao.

## Structure

```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/         # POST /auth/sync, GET /auth/me, JwtAuthGuard, @CurrentUser()
│   │   ├── content/      # POST /content, GET /content, GET /content/:id
│   │   ├── llm/          # GeminiService: structured batch calls to Gemini API
│   │   ├── nlp/          # NlpService: HTTP client to FastAPI NLP microservice
│   │   └── job/          # PipelineService (fire-and-forget), stuck-job cron
│   ├── common/
│   │   ├── config/       # ConfigModule / environment variables
│   │   ├── decorators/   # @CurrentUser()
│   │   └── guards/       # JwtAuthGuard
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
├── test/
├── package.json
└── .env
```

## Environment

```bash
FRONTEND_URL=http://localhost:3000
JWT_SECRET=changeme          # must equal AUTH_SECRET used by Auth.js frontend
JWT_EXPIRE_MINUTES=10080
GEMINI_API_KEY=              # from aistudio.google.com/apikey
DATABASE_URL=postgresql://...
NLP_SERVICE_URL=http://localhost:8001
LLM_BATCH_SIZE=5
# No GOOGLE_CLIENT_ID/SECRET — backend never touches OAuth
```

## Key Rules

- Controllers are thin — all logic lives in services.
- API contract source of truth: `docs/openapi.yaml`. Keep controllers consistent with it.
- Never hardcode secrets — use `.env` via `@nestjs/config`.
- Never touch `frontend/` or `nlp-service/`.
- No BullMQ, no Redis, no Passport, no queue. Background jobs are fire-and-forget async.

## Running

```bash
cd backend
npm install
npm run start:dev
# Swagger: http://localhost:8000/api
# Requires: PostgreSQL (Neon or local), NLP service on :8001
```

---

## Auth Module

Backend never runs OAuth. Auth.js on the frontend handles Google and Kakao OAuth flows.
Backend only: validates Auth.js-issued JWTs, and syncs/upserts User records on first login.

### POST /auth/sync (public — no guard)

Called by Auth.js `jwt()` callback on the frontend on first sign-in from either Google or Kakao.

```typescript
// Request body
interface SyncDto {
  provider: 'google' | 'kakao';
  providerAccountId: string;  // unique ID from the provider
  email: string | null;       // nullable — Kakao users may not have email without Biz App
  name: string;
  avatarUrl: string | null;
}

// Upsert logic — key by (provider, providerAccountId), NOT by email
// email is nullable — never use it as the upsert key
async sync(dto: SyncDto): Promise<User> {
  return this.prisma.user.upsert({
    where: {
      provider_providerAccountId: {
        provider: dto.provider,
        providerAccountId: dto.providerAccountId,
      },
    },
    update: { name: dto.name, avatarUrl: dto.avatarUrl, email: dto.email },
    create: { ...dto },
  });
}
```

Returns `User` shape matching `openapi.yaml`.

### GET /auth/me (JwtAuthGuard)

Returns current user from DB using `sub` from JWT payload (= backend `user.id` UUID).

### JwtAuthGuard — plain NestJS guard, no Passport

Do NOT use `passport-jwt` or `@nestjs/passport`. Use `@nestjs/jwt` with a plain `CanActivate` guard:

```typescript
// src/common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new UnauthorizedException();
    try {
      req.user = this.jwtService.verify(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

### @CurrentUser() decorator

```typescript
// src/common/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest().user,
);
```

---

## Prisma Schema

```prisma
model User {
  id                String    @id @default(uuid())
  provider          String    // 'google' | 'kakao'
  providerAccountId String    // unique ID from the provider
  email             String?   // nullable — Kakao without Biz App has no email
  name              String
  avatarUrl         String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  jobs              Job[]

  @@unique([provider, providerAccountId])
}

model Job {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  status    String   // 'pending' | 'processing' | 'completed' | 'failed'
  progress  Int      @default(0)
  error     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  content   Content?
}

model Content {
  id        String   @id @default(uuid())
  jobId     String   @unique
  job       Job      @relation(fields: [jobId], references: [id])
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Background Pipeline (no queue)

### Content controller — POST /content

```typescript
@Post()
@UseGuards(JwtAuthGuard)
async create(@Body() dto: CreateContentDto, @CurrentUser() user: User) {
  const job = await this.prisma.job.create({
    data: { status: 'pending', userId: user.id },
  });
  this.pipeline.run(job.id, dto.text).catch((err) => {
    this.logger.error(`Pipeline crashed for job ${job.id}`, err);
  });
  return { job_id: job.id }; // 202 Accepted
}
```

### Content controller — GET /content/:id

```typescript
@Get(':id')
@UseGuards(JwtAuthGuard)
async findOne(@Param('id') id: string) {
  const job = await this.prisma.job.findUniqueOrThrow({ where: { id } });
  if (job.status === 'pending' || job.status === 'processing') {
    throw new HttpException({ status: job.status, progress: job.progress }, 202);
  }
  if (job.status === 'failed') {
    throw new InternalServerErrorException({ detail: job.error });
  }
  const content = await this.prisma.content.findUniqueOrThrow({ where: { jobId: id } });
  return content.data;
}
```

### PipelineService

```typescript
async run(jobId: string, text: string): Promise<void> {
  try {
    await this.updateJob(jobId, { status: 'processing', progress: 0 });
    const sentences = await this.nlp.segment(text);
    await this.updateJob(jobId, { progress: 16 });
    const vocabHits = await this.nlp.vocab(sentences);
    await this.updateJob(jobId, { progress: 33 });
    const grammarPatterns = await this.nlp.grammar(sentences);
    await this.updateJob(jobId, { progress: 50 });
    const llmResults = await this.llm.batchAnalyze(sentences, grammarPatterns);
    await this.updateJob(jobId, { progress: 66 });
    const overallLevel = computeOverallLevel(llmResults);
    await this.updateJob(jobId, { progress: 83 });
    const data = buildContentFull(sentences, vocabHits, llmResults, overallLevel);
    await this.prisma.content.create({ data: { jobId, data } });
    await this.updateJob(jobId, { status: 'completed', progress: 100 });
  } catch (err) {
    await this.updateJob(jobId, { status: 'failed', error: err.message });
  }
}
```

### Stuck-job cron

```typescript
@Cron('0 * * * *')
async clean() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  await this.prisma.job.updateMany({
    where: { status: 'processing', updatedAt: { lt: tenMinutesAgo } },
    data: { status: 'failed', error: 'Job timed out' },
  });
}
```

---

## Gemini API Integration

Package: `@google/genai` (NOT `@google/generative-ai`).

```typescript
import { GoogleGenAI } from '@google/genai';
this.ai = new GoogleGenAI({ apiKey: this.config.get('GEMINI_API_KEY') });
```

Model: `gemini-2.5-flash`. Structured output via `responseMimeType: 'application/json'` + `responseSchema`. Zod-validate the parsed response. Batch size: `LLM_BATCH_SIZE` env var (default 5).

---

## NLP Service Client

```typescript
async segment(text: string): Promise<string[]> {
  const { data } = await firstValueFrom(
    this.http.post(`${this.baseUrl}/segment`, { text }),
  );
  return data.sentences;
}
```

Same pattern for `vocab()` and `grammar()`. Wrap all calls in try/catch; on failure set job to `failed`.

---

## Test Execution Protocol

**Never run tests directly.**

Write `.runtime/requests/<id>.json`:

```json
{
  "id": "auth-sync-001",
  "type": "targeted",
  "test_file": "src/modules/auth/auth.service.spec.ts",
  "requested_by": "BA",
  "timestamp": 1747820000
}
```

Poll `.runtime/results/<id>.json`. Delete after reading. Never run `npm run test` or `npx jest` directly.
