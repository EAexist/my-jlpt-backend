# Library Usage Summary — JLPT Backend API

**Stack**: TypeScript 5.7.x, Node.js 22, NestJS 11 backend on Google Cloud Run, PostgreSQL via Prisma.

## Libraries & Responsibilities

- **@nestjs/core, @nestjs/common, @nestjs/platform-express** — core web framework; modular structure by bounded context (health, auth, group, content, job, storage, nlp, llm, prisma, common); Express-based HTTP layer.
- **@nestjs/config** — environment/config loading across modules.
- **@nestjs/swagger** — generates OpenAPI spec (`scripts/generate-openapi.ts`); `./.agents/specs/openapi.json` is the binding contract for public endpoints, schemas, status codes, error shapes.
- **Prisma 6** — PostgreSQL ORM; persists `ProcessingJob`, generated grammar-example cache, chunked sentences, deduplicated vocabulary; all writes tied to callback idempotency requirements.
- **@google-cloud/tasks** — dispatches async jobs (chunking + vocabulary-matching) to external FastAPI NLP worker; NLP worker also uses Cloud Tasks to enqueue its own result callback back to this service (retryable delivery).
- **@google-cloud/storage** — stores intermediate uploaded files (PDF/text, <10MB) during content ingestion.
- **google-auth-library** — verifies Google-signed OIDC identity tokens on the private `POST /internal/jobs/{jobId}/callback` endpoint (defense-in-depth alongside Cloud Run IAM invoker binding); distinct from learner-facing auth.
- **jose** — verifies learner-facing bearer tokens (JWT) for authenticated API access.
- **@google/genai** — Gemini client used by `llm` module for (1) grammar-pattern identification per sentence chunk and (2) per-grammar-point example generation, computing `Content.overallLevel`; runs after NLP worker callback, consuming its sentence-chunk output.
- **RxJS** — in-memory per-job `BehaviorSubject` registry powering SSE status streaming (`GET /content/{id}/status`); late subscribers get current state immediately; terminal state closes stream and evicts subject.
- **Zod** — schema validation (request/DTO validation across modules).
- **Vitest, @nestjs/testing, Supertest** — unit/integration/e2e testing; generated OpenAPI verification.

## Module → Library Map

| Module | Primary Libraries |
|---|---|
| auth | jose |
| content | @google-cloud/storage, @google-cloud/tasks, Prisma, Zod |
| job | Prisma, google-auth-library, RxJS |
| storage | @google-cloud/storage |
| nlp | @google-cloud/tasks (dispatch only; no grammar logic) |
| llm | @google/genai, Prisma (grammar-example cache) |
| prisma | Prisma (PostgreSQL) |
| common/health | @nestjs/common, @nestjs/config |