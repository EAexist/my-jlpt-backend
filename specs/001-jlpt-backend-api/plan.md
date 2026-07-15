# Implementation Plan: JLPT Backend API

**Branch**: `develop` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-jlpt-backend-api/spec.md`

## Summary

Implement the JLPT Study Material Generator backend by extending the current NestJS codebase in place and making `./.agents/specs/openapi.json` the binding external API contract. The backend remains a minimal modular NestJS web service: health, auth, groups, content, jobs, storage, processing orchestration, and generated-study-material persistence. `package.json` is the source of truth for allowed libraries; planning uses only dependencies already declared there.

**Upload architecture migration**: File ingestion moves from a backend-proxied upload (client sends raw file bytes to NestJS, which re-uploads them to GCS via the SDK) to a pre-signed URL handoff. The `storage` module now exposes an endpoint that issues short-lived (5-15 minute) V4 signed `PUT` URLs directly against a GCS bucket object path; the client uploads bytes straight to GCS, and the NestJS process never buffers or streams a file body. This removes Multer-based multipart file handling from the ingestion path entirely and eliminates the associated request-body size/RAM pressure on the backend.

## Technical Context

**Language/Version**: TypeScript 5.7.x on Node.js 22 types

**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`), Prisma 6, `@google-cloud/tasks`, `@google-cloud/storage` (as of this revision, used exclusively to mint short-lived V4 signed `PUT` URLs for direct client-to-GCS uploads and to verify uploaded object metadata after the fact — the NestJS process no longer accepts, buffers, or re-uploads file bytes itself, so no multipart/Multer file-body parsing remains on the ingestion path), `google-auth-library` (verifies Google-signed OIDC identity tokens on the private NLP-worker result-callback endpoint, distinct from the learner-facing `jose` bearer-token path), `@google/genai` (used by the `llm` module for both grammar-example generation and, as of this revision, grammar-pattern identification per sentence — grammar analysis is no longer performed by the external NLP worker), `jose`, RxJS, Zod

**Storage**: PostgreSQL through Prisma; Google Cloud Storage for intermediate uploaded files, populated via direct client-to-bucket signed-URL uploads rather than backend-mediated writes; generated grammar-example cache persisted in PostgreSQL

**Testing**: Vitest, `@nestjs/testing`, Supertest, TypeScript type-checking, generated OpenAPI verification

**Target Platform**: HTTP web service deployed to Google Cloud Run, with private service-to-service communication to the NLP worker

**Project Type**: Backend web service / API orchestrator

**Performance Goals**: Accept 95% of valid text submissions within 2 seconds and valid supported file submissions within 3 seconds under expected load; stream terminal status for 99% of jobs without manual intervention

**Constraints**: Must implement `./.agents/specs/openapi.json` exactly for observable API behavior; must satisfy `./.agents/specs/draft.md`; must not add libraries outside `package.json`; file inputs are PDF or plain text and must be smaller than 10 MB; file bytes must never be proxied through the NestJS process — learners obtain a backend-issued, short-lived (5-15 minute) signed URL and upload directly to GCS, and content submissions reference the resulting object key rather than attaching a file body; CPU-intensive extraction and NLP analysis stay outside the NestJS service; the NLP worker returns results by enqueueing its own Cloud Task back to this service's private callback endpoint (not a direct synchronous call), authenticated via a Cloud Run IAM invoker binding plus in-app OIDC token verification

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
|-- content/   # ContentModule
|   |-- content-ingestion/
|   |   |-- content-ingestion.service.ts
|   |   |-- content-ingestion.schemas.ts
|   |   |-- content-ingestion.spec.ts
|   |   `-- content-ingestion.contract.spec.ts
|   |-- content-management/
|   |   |-- content-management.service.ts
|   |   |-- content-management.service.spec.ts
|   |   |-- content-management.schemas.ts
|   |   `-- content-management.contract.spec.ts
|   |-- content.controller.ts
|   |-- content.module.ts
|   |-- content.presenter.ts
|   `-- entities/
|       `-- content.entity.ts
|-- job/       # JobModule
|-- storage/   # StorageModule
|-- nlp/       # NlpModule
|-- llm/       # LlmModule
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

Within `content`, ingestion (signed-URL issuance, object verification, dispatch) and management (listing, move, delete) are implemented as separate services — `content-ingestion.service.ts` and `content-management.service.ts` — behind one `ContentModule` and one `ContentController`, since the two responsibilities have different collaborators (Storage/NLP vs. Prisma-only) and different callers (learner submission vs. `GroupController` listing). `ContentController` exposes `POST /content/upload-url` (delegates to `StorageModule` to mint a signed URL, no file body accepted) in addition to the existing `POST /content` (now accepting either raw text or an `{objectKey, fileName, mimeType}` reference, never a multipart file body) and management endpoints.

`job` owns the `ProcessingJob` entity's full lifecycle exclusively, including the inbound boundary with the private NLP worker: it is never called by learners directly. `GroupModule` and `ContentModule` import each other's exported services explicitly where a cross-module read is required (e.g., `GroupController` injecting `ContentManagementService`); shared infrastructure modules (`PrismaModule`, `StorageModule`, `NlpModule`, `LlmModule`) are likewise imported by name into each module that needs them rather than declared as `@Global()`, so each module's dependency graph stays visible from its own file.

**Result Callback**: The NLP worker never calls this service synchronously and is never queried by it. On completion, the worker enqueues its own Cloud Task targeting this service's private `POST /internal/jobs/{jobId}/callback` endpoint, carrying only the output of its two remaining responsibilities: (1) the input text segmented into ordered chunks of 2-3 sentences each, and (2) extracted vocabulary items matched against the worker's own dictionary. **The NLP worker no longer identifies grammar patterns or produces grammar examples** — that responsibility now belongs to this service's `llm` module, which calls Gemini (`@google/genai`) after the callback is received, using the worker's sentence chunks as input. This boundary is protected at two layers: the Cloud Run IAM invoker binding rejects any caller other than the worker's service account before the request reaches application code, and the endpoint additionally verifies the attached OIDC identity token in-app via `google-auth-library` as defense in depth.

> **Resolved**: the `llm` module's grammar analysis consumes the NLP worker's chunk output as its input (one Gemini call per chunk, or batched — implementation detail), so it strictly depends on the callback having arrived first; it cannot run before or independently of it. The exact request/response payload shape for `POST /internal/jobs/{jobId}/callback` (chunk list, vocabulary list) is defined authoritatively in the FastAPI NLP service spec (`specs/002-nlp-worker-service/plan.md`), since that service is the payload's producer — `job.controller.ts` must accept exactly that shape.
>
> **Still open (see chat)**: whether the Gemini-based grammar analysis runs synchronously inside the callback request handler before the HTTP response is returned to the worker's Cloud Task, or is dispatched as a further asynchronous step with `ProcessingJob.status` remaining `PROCESSING` and `currentStep` updated accordingly. This is a NestJS-internal orchestration decision and does not affect the FastAPI NLP worker's contract either way.

Persisting the callback (chunked sentences, deduplicated vocabulary), performing grammar analysis, and flipping the `ProcessingJob` to a terminal state must together be idempotent, so a Cloud Tasks retry after a partial failure cannot double-write results or re-invoke Gemini redundantly. Using a worker-initiated Cloud Task rather than a direct HTTP call means delivery of the NLP worker's chunking/vocabulary output is retried automatically if this service is briefly unavailable, without re-running that NLP analysis itself.

**Upload verification**: Requesting a signed URL is idempotent and side-effect-free beyond issuing a new URL for the same object path; it does not create a `Content` or `ProcessingJob` row. A `Content` row and its downstream Cloud Tasks dispatch are only created once, at `POST /content` time, after `StorageModule` confirms the referenced object exists, matches the declared content type, and is under the 10 MB limit — a repeated `POST /content` for an already-claimed `objectKey` must not be allowed to create a second `Content` record referencing the same upload.

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