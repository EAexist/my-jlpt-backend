# Implementation Plan: JLPT Backend API

**Branch**: `develop` | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-jlpt-backend-api/spec.md`

## Summary

Extend the existing NestJS codebase in place; The backend stays a minimal modular NestJS service: health, auth, groups, content, jobs, storage, and processing orchestration. `package.json` is the source of truth for allowed libraries.

File ingestion uses a pre-signed URL handoff, not a backend-proxied upload: `storage` issues short-lived (5-15 minute) V4 signed `PUT` URLs against a GCS object path, the client uploads bytes directly to GCS, and NestJS never buffers or streams a file body. There is no Multer-based multipart handling on the ingestion path.

All NLP and LLM/Gemini processing (segmentation, vocabulary extraction, grammar-pattern identification, example generation) is performed by an external FastAPI microservice, not by NestJS. NestJS only dispatches jobs, receives the finished result via callback, and persists it.

## Technical Context

**Language/Version**: TypeScript 5.7.x on Node.js 22 types

**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`), Prisma 6, `@google-cloud/tasks`, `@google-cloud/storage` (used only to mint short-lived V4 signed `PUT` URLs and to verify uploaded object metadata — no file-body parsing), `jose`, RxJS, Zod

**Storage**: PostgreSQL through Prisma (sole writer for all persisted state, including generated grammar-example cache); Google Cloud Storage for intermediate uploaded files, populated via direct client-to-bucket signed-URL uploads

**Testing**: Vitest, `@nestjs/testing`, Supertest, TypeScript type-checking, generated OpenAPI verification

**Target Platform**: HTTP web service on Google Cloud Run, with private service-to-service communication to the external processing microservice

**Project Type**: Backend web service / API orchestrator

**Performance Goals**: Accept 95% of valid text submissions within 2 seconds and valid supported file submissions within 3 seconds under expected load; stream terminal status for 99% of jobs without manual intervention

**Constraints**: Must not add libraries outside `package.json`; file bytes must never be proxied through NestJS — learners get a backend-issued signed URL and upload directly to GCS, referencing the resulting object key on submission; all NLP/LLM analysis and generation stay outside the NestJS service; results return via the microservice enqueueing its own Cloud Task to this service's private callback endpoint (not a direct synchronous call); that endpoint relies solely on Cloud Run IAM invoker binding + `--ingress internal` — no in-app OIDC/token verification in NestJS

**Scale/Scope**: Single backend service coordinating authenticated learners, private groups, private content, async processing jobs, GCS uploads, Cloud Tasks dispatch, and callback/result persistence

## Project Structure

### Documentation (this feature)

```text
specs/001-jlpt-backend-api/
|-- plan.md
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
|-- nlp/       # NlpModule (dispatch + callback intake only; no analysis logic)
|-- prisma/
`-- common/

prisma/
`-- schema.prisma

scripts/
`-- generate-openapi.ts

specs/
`-- api.ts
```

**Structure Decision**: Single NestJS backend project with feature modules by bounded context. Existing `auth`, `content`, `health`, and `job` modules are extended; `group` is added for a missing contract context; `storage`, `nlp`, `prisma`, `common` are the integration-boundary modules. Tests remain beside modules using the existing `*.spec.ts` convention.

Within `content`, ingestion (signed-URL issuance, object verification, dispatch) and management (listing, move, delete) are implemented as separate services — `content-ingestion.service.ts` and `content-management.service.ts` — behind one `ContentModule` and one `ContentController`, since the two responsibilities have different collaborators (Storage/NLP vs. Prisma-only) and different callers (learner submission vs. `GroupController` listing). `ContentController` exposes `POST /content/upload-url` (delegates to `StorageModule` to mint a signed URL, no file body accepted) in addition to the existing `POST /content` (now accepting either raw text or an `{objectKey, fileName, mimeType}` reference, never a multipart file body) and management endpoints.

`job` owns the `ProcessingJob` entity's full lifecycle exclusively, including the inbound boundary with the external processing microservice; it is never called by learners directly. Shared infrastructure modules (`PrismaModule`, `StorageModule`, `NlpModule`) are imported by name into each module that needs them rather than declared `@Global()`, so each module's dependency graph stays visible from its own file.

## Processing Microservice Integration

A single external FastAPI microservice owns all NLP and LLM work: text segmentation, vocabulary extraction, grammar-pattern identification, and Gemini-based example generation. It is isolated and asynchronous, with no synchronous calls in either direction. On completion it enqueues a Cloud Task to this service's private callback endpoint:

```text
POST /internal/jobs/{jobId}/callback
```

Payload: ordered text chunks, extracted vocabulary, and generated grammar patterns/examples for the job, ready to persist as-is (schema defined in `specs/002-nlp-worker-service/plan.md`). NestJS's only responsibility here is to persist the payload via Prisma and transition the `ProcessingJob` to its terminal state; it does not call Gemini or perform any analysis itself.

**Security**: enforced entirely at the infrastructure layer. Cloud Run IAM invoker binding plus `--ingress internal` guarantee any request reaching this endpoint originates from the authorized microservice account via Cloud Tasks. No in-app OIDC verification or `google-auth-library` usage in NestJS.

**Idempotency**: because Cloud Tasks may retry, persisting the payload and transitioning the job to terminal state must be idempotent - no duplicate rows, no duplicate side effects on retry.

## Content & Status Semantics

**Upload verification**: Requesting a signed URL is idempotent and side-effect-free beyond issuing a new URL for the same object path; it does not create a `Content` or `ProcessingJob` row. A `Content` row and its downstream Cloud Tasks dispatch are only created once, at `POST /content` time, after `StorageModule` confirms the referenced object exists, matches the declared content type, and is under the 10 MB limit — a repeated `POST /content` for an already-claimed `objectKey` must not be allowed to create a second `Content` record referencing the same upload.

**Status Streaming**: Job status updates for `GET /content/{id}/status` are served entirely from the NestJS layer via an in-memory, per-job RxJS `BehaviorSubject` registry backed by the persisted `ProcessingJob` row — the microservice is never queried directly for status. A late SSE subscriber must immediately receive current state (not just future emissions), and a terminal state must both close the SSE stream and evict the subject from the registry.

## Complexity Tracking

No constitution violations or intentional complexity exceptions.