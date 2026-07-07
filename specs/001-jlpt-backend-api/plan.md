# Implementation Plan: JLPT Backend API

**Branch**: `develop` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-jlpt-backend-api/spec.md`

## Summary

Implement the JLPT Study Material Generator backend by extending the current NestJS codebase in place and making `./.agents/specs/openapi.json` the binding external API contract. The backend remains a minimal modular NestJS web service: health, auth, groups, content, jobs, storage, processing orchestration, and generated-study-material persistence. `package.json` is the source of truth for allowed libraries; planning uses only dependencies already declared there.

## Technical Context

**Language/Version**: TypeScript 5.7.x on Node.js 22 types

**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`), Prisma 6, `@google-cloud/tasks`, `@google-cloud/storage`, `google-auth-library` (verifies Google-signed OIDC identity tokens on the private NLP-worker result-callback endpoint, distinct from the learner-facing `jose` bearer-token path), `@google/genai`, `jose`, RxJS, Zod

**Storage**: PostgreSQL through Prisma; Google Cloud Storage for intermediate uploaded files; generated grammar-example cache persisted in PostgreSQL

**Testing**: Vitest, `@nestjs/testing`, Supertest, TypeScript type-checking, generated OpenAPI verification

**Target Platform**: HTTP web service deployed to Google Cloud Run, with private service-to-service communication to the NLP worker

**Project Type**: Backend web service / API orchestrator

**Performance Goals**: Accept 95% of valid text submissions within 2 seconds and valid supported file submissions within 3 seconds under expected load; stream terminal status for 99% of jobs without manual intervention

**Constraints**: Must implement `./.agents/specs/openapi.json` exactly for observable API behavior; must satisfy `./.agents/specs/draft.md`; must not add libraries outside `package.json`; file inputs are PDF or plain text and must be smaller than 10 MB; CPU-intensive extraction and NLP analysis stay outside the NestJS service; the NLP worker returns results by enqueueing its own Cloud Task back to this service's private callback endpoint (not a direct synchronous call), authenticated via a Cloud Run IAM invoker binding plus in-app OIDC token verification

**Scale/Scope**: Single backend service coordinating authenticated learners, private groups, private content, async processing jobs, GCS uploads, Cloud Tasks dispatch, Gemini generation, and callback/result persistence

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The current constitution file is an uncustomized placeholder and does not define enforceable gates. Feature-specific gates are therefore:

- Contract fidelity: `./.agents/specs/openapi.json` remains the source of truth for public endpoints, schemas, status codes, and error shapes.
- Dependency discipline: `package.json` is the complete allowed library set for implementation planning.
- Architecture fidelity: `./.agents/specs/draft.md` governs service responsibility boundaries, asynchronous processing, private NLP worker communication, persistence, caching, and GCP infrastructure assumptions.
- Minimal NestJS structure: keep modules scoped by bounded context and avoid new architectural layers unless required by contract, persistence, or external integration boundaries.

Gate status before Phase 0: PASS. No unresolved clarifications.

## Project Structure

### Documentation (this feature)

```text
specs/001-jlpt-backend-api/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- external-api.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- main.ts
|-- app.module.ts
|-- health/
|-- auth/
|-- group/
|-- content/   # ContentModule: learner-facing CRUD; service layer split into
|              # content-ingestion.service.ts (submission, GCS upload, Cloud Tasks dispatch)
|              # and content-management.service.ts (list/move/delete)
|-- job/       # JobModule: ProcessingJob lifecycle only — NLP worker result callback
|              # (job.controller.ts, job-callback-auth.guard.ts) and the in-memory
|              # status registry (job-status.service.ts) consumed by content's SSE endpoint
|-- storage/
|-- nlp/
|-- llm/
|-- prisma/
`-- common/

prisma/
`-- schema.prisma

scripts/
`-- generate-openapi.ts

specs/
`-- api.ts
```

**Structure Decision**: Use a single NestJS backend project with feature modules by bounded context. Existing `auth`, `content`, `health`, and `job` modules are extended; new modules are added only for missing contract contexts (`group`) or real integration boundaries (`storage`, `nlp`, `llm`, `prisma`, `common`). Tests remain beside modules using the existing `*.spec.ts` convention.

Within `content`, ingestion (submission, upload, dispatch) and management (listing, move, delete) are implemented as separate services — `content-ingestion.service.ts` and `content-management.service.ts` — behind one `ContentModule` and one `ContentController`, since the two responsibilities have different collaborators (Storage/NLP vs. Prisma-only) and different callers (learner submission vs. `GroupController` listing).

`job` owns the `ProcessingJob` entity's full lifecycle exclusively, including the inbound boundary with the private NLP worker: it is never called by learners directly. `GroupModule` and `ContentModule` import each other's exported services explicitly where a cross-module read is required (e.g., `GroupController` injecting `ContentManagementService`); shared infrastructure modules (`PrismaModule`, `StorageModule`, `NlpModule`, `LlmModule`) are likewise imported by name into each module that needs them rather than declared as `@Global()`, so each module's dependency graph stays visible from its own file.

**Result Callback**: The NLP worker never calls this service synchronously and is never queried by it. On completion, the worker enqueues its own Cloud Task targeting this service's private `POST /internal/jobs/{jobId}/callback` endpoint, carrying the analysis results. This boundary is protected at two layers: the Cloud Run IAM invoker binding rejects any caller other than the worker's service account before the request reaches application code, and the endpoint additionally verifies the attached OIDC identity token in-app via `google-auth-library` as defense in depth. Persisting the callback (sentences, grammar examples, deduplicated vocabulary) and flipping the `ProcessingJob` to a terminal state happen together, idempotently, so a Cloud Tasks retry after a partial failure cannot double-write results. Using a worker-initiated Cloud Task rather than a direct HTTP call means delivery is retried automatically if this service is briefly unavailable, without re-running the NLP analysis itself.

**Status Streaming**: Job status updates for `GET /content/{id}/status` are served entirely from the NestJS layer via an in-memory, per-job RxJS `BehaviorSubject` registry backed by the persisted `ProcessingJob` row — the microservice is never queried directly for status. A late SSE subscriber must immediately receive current state (not just future emissions), and a terminal state must both close the SSE stream and evict the subject from the registry.

## Complexity Tracking

No constitution violations or intentional complexity exceptions.

## Phase 0: Research Summary

See [research.md](./research.md). Decisions are resolved with no open clarification markers.

## Phase 1: Design Summary

See [data-model.md](./data-model.md), [contracts/external-api.md](./contracts/external-api.md), and [quickstart.md](./quickstart.md).

## Post-Design Constitution Check

Gate status after Phase 1: PASS.

- Contract artifacts reference the canonical OpenAPI source instead of creating a competing contract.
- Data model covers all feature entities, ownership rules, validation rules, and lifecycle transitions.
- Quickstart uses existing package scripts only.
- Planned structure preserves a minimal NestJS module layout and does not add dependencies beyond `package.json`.
- Cross-module and infrastructure dependencies (Prisma, Storage, NLP, LLM, and cross-feature service reads such as Group-on-Content) are wired through explicit module imports/exports rather than global providers, keeping each module's dependency graph declared in its own file.