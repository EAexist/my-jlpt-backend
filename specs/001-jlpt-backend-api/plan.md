# Implementation Plan: JLPT Backend API

**Branch**: `develop` | **Date**: 2026-06-23 | **Updated**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-jlpt-backend-api/spec.md`

## Summary

Implement the JLPT Study Material Generator backend by extending the current NestJS codebase in place and making `./.agents/specs/openapi.json` the binding external API contract. The backend remains a minimal modular NestJS web service: health, auth, groups, content, jobs, storage, processing orchestration, and generated-study-material persistence. `package.json` is the source of truth for allowed libraries; planning uses only dependencies already declared there.

> **Upload architecture migration**: File ingestion moves from a backend-proxied upload (client sends raw file bytes to NestJS, which re-uploads them to GCS via the SDK) to a pre-signed URL handoff. The `storage` module now exposes an endpoint that issues short-lived (5-15 minute) V4 signed `PUT` URLs directly against a GCS bucket object path; the client uploads bytes straight to GCS, and the NestJS process never buffers or streams a file body. This removes Multer-based multipart file handling from the ingestion path entirely and eliminates the associated request-body size/RAM pressure on the backend.

## Technical Context

**Language/Version**: TypeScript 5.7.x on Node.js 22 types

**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`), Prisma 6, `@google-cloud/tasks`, `@google-cloud/storage` (as of this revision, used exclusively to mint short-lived V4 signed `PUT` URLs for direct client-to-GCS uploads and to verify uploaded object metadata after the fact — the NestJS process no longer accepts, buffers, or re-uploads file bytes itself, so no multipart/Multer file-body parsing remains on the ingestion path), `@google/genai` (used by the `llm` module for both grammar-example generation and, as of this revision, grammar-pattern identification per sentence — grammar analysis is no longer performed by the external NLP worker), `jose`, RxJS, Zod

**Storage**: PostgreSQL through Prisma; Google Cloud Storage for intermediate uploaded files, populated via direct client-to-bucket signed-URL uploads rather than backend-mediated writes; generated grammar-example cache persisted in PostgreSQL

**Testing**: Vitest, `@nestjs/testing`, Supertest, TypeScript type-checking, generated OpenAPI verification

**Target Platform**: HTTP web service deployed to Google Cloud Run, with private service-to-service communication to the NLP worker

**Project Type**: Backend web service / API orchestrator

**Performance Goals**: Accept 95% of valid text submissions within 2 seconds and valid supported file submissions within 3 seconds under expected load; stream terminal status for 99% of jobs without manual intervention

**Constraints**: Must implement `./.agents/specs/openapi.json` exactly for observable API behavior; must not add libraries outside `package.json`; file bytes must never be proxied through the NestJS process — learners obtain a backend-issued, short-lived (5-15 minute) signed URL and upload directly to GCS, and content submissions reference the resulting object key rather than attaching a file body; CPU-intensive extraction and NLP analysis stay outside the NestJS service; the NLP worker returns results by enqueueing its own Cloud Task back to this service's private callback endpoint (not a direct synchronous call), authenticated via a Cloud Run IAM invoker binding plus in-app OIDC token verification

**Scale/Scope**: Single backend service coordinating authenticated learners, private groups, private content, async processing jobs, GCS uploads, Cloud Tasks dispatch, Gemini generation, and callback/result persistence

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
Here is the revised, highly focused spec document tailored specifically for your NestJS development agent. All details concerning the internal implementation of the FastAPI side have been omitted, leaving only what the NestJS service is responsible for implementing and handling.

**NLP Worker Integration & Callback Lifecycle** The NLP worker is an isolated, asynchronous microservice. It does not communicate synchronously with this service. Upon processing completion, it delivers results asynchronously via a Google Cloud Tasks callback.

**NestJS Service Responsibilities & Callback Flow**
[ Cloud Tasks Callback ] ──► [ NestJS Controller ] ──► [ Persist Chunks/Vocab ] ──► [ Gemini API ]
Boundary Shift: The NLP worker no longer identifies grammar patterns or generates examples. The NestJS llm module is now solely responsible for this.

**The Callback Endpoint**: You must implement a private callback handler:
POST /internal/jobs/{jobId}/callback

Input Payload: Consists of (1) the input text segmented into ordered chunks of 2-3 sentences each, and (2) extracted vocabulary items matched against the worker's dictionary. The exact payload schema is defined in specs/002-nlp-worker-service/plan.md.

Downstream Execution: Upon receiving this callback, NestJS must persist the chunks and vocabulary, then immediately trigger the llm module to call Gemini (@google/genai) using the received sentence chunks as input. This analysis is strictly dependent on the callback having arrived first.

**Security & Infrastructure Constraints**
- Access control is enforced strictly at the Google Cloud infrastructure layer. Do not write complex application-level security code.
- Infrastructure Gatekeeping: Cloud Run IAM and ingress limits (--ingress internal) handle all authentication. Any request hitting the NestJS container has already been verified as originating from the authorized NLP worker Service Account via Cloud Tasks.
- No In-App Verification: Do not use google-auth-library or any manual OIDC token verification logic in NestJS. It is redundant and handled entirely by the platform.

**Reliability & Idempotency Requirements**
- Because the callback is delivered via Google Cloud Tasks, your implementation must handle retries safely:
  - Idempotency: Persisting the callback data (chunks/vocabulary), executing the Gemini LLM analysis, and transitioning the ProcessingJob to its terminal state must be strictly idempotent.
  - Handling Retries: If Cloud Tasks retries the callback due to a partial failure, the NestJS service must ensure it does not write duplicate database records or execute redundant, costly Gemini API calls.

**Upload verification**: Requesting a signed URL is idempotent and side-effect-free beyond issuing a new URL for the same object path; it does not create a `Content` or `ProcessingJob` row. A `Content` row and its downstream Cloud Tasks dispatch are only created once, at `POST /content` time, after `StorageModule` confirms the referenced object exists, matches the declared content type, and is under the 10 MB limit — a repeated `POST /content` for an already-claimed `objectKey` must not be allowed to create a second `Content` record referencing the same upload.

**Status Streaming**: Job status updates for `GET /content/{id}/status` are served entirely from the NestJS layer via an in-memory, per-job RxJS `BehaviorSubject` registry backed by the persisted `ProcessingJob` row — the microservice is never queried directly for status. A late SSE subscriber must immediately receive current state (not just future emissions), and a terminal state must both close the SSE stream and evict the subject from the registry.

## Complexity Tracking

No constitution violations or intentional complexity exceptions.

## Phase 1: Design Summary

See [data-model.md](./data-model.md), [contracts/external-api.md](./contracts/external-api.md).