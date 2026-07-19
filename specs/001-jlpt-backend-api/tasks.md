# Tasks: JLPT Backend API

**Input**: Design documents from `/specs/001-jlpt-backend-api/`
<!-- **Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/external-api.md, quickstart.md -->
**Prerequisites**: plan.md, data-model.md, contracts/external-api.md
<!-- **Tests**: Included because the specification requires contract verification, authorization testing, and an end-to-end flow. -->
**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

<!-- - **[P]**: Can run in parallel because it targets different files or has no dependency on incomplete tasks -->
- **[Story]**: Maps to user stories from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing NestJS project for contract-bound implementation.

<!-- - [ ] T001 Fix malformed JSON in canonical OpenAPI contract so tooling can parse it in .agents/specs/openapi.json
- [ ] T002 [P] Add generated OpenAPI comparison helper for .agents/specs/openapi.json in scripts/generate-openapi.ts -->
- [X] T003a [P] Add API base path `/api/v1` in src/main.ts
- [X] T003b [P] Add global config loading in src/main.ts
- [X] T003c [P] Add validation plumbing in src/main.ts
- [X] T004 [P] Define required environment variables and defaults in src/common/config/env.schema.ts
- [X] T005 [P] Add shared API response/error constants matching ApiError in src/common/api/api-error.ts
- [X] T006 [P] Create reusable test application bootstrap helpers in src/common/testing/app-test-utils.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence, authentication, ownership, validation, and integration boundaries required before any story can be completed.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Define Prisma models and enums for Learner, Group, Content, ProcessingJob, SentenceAnalysis, GrammarPoint, GrammarExample, GrammarExampleCache, VocabularyItem, and UploadedFile in prisma/schema.prisma
- [X] T008 Generate Prisma migration for the JLPT data model in prisma/migrations/001_jlpt_backend_api/migration.sql
- [X] T009 [P] Add PrismaModule and PrismaService lifecycle management in src/prisma/prisma.module.ts and src/prisma/prisma.service.ts
- [X] T010 [P] Add current learner request type and decorator in src/auth/current-learner.decorator.ts
- [X] T011 [P] Implement bearer token verification with jose in src/auth/bearer-auth.guard.ts
- [X] T012 [P] Implement ownership and resource error helpers in src/auth/ownership.service.ts
- [X] T013 [P] Implement Zod validation pipe and exception mapping in src/common/validation/zod-validation.pipe.ts
- [X] T014 [P] Implement centralized ApiError exception filter in src/common/filters/api-error.filter.ts
- [ ] T015 [P] Add GCS upload boundary in src/storage/storage.module.ts and src/storage/storage.service.ts
- [ ] T016 [P] Add Cloud Tasks dispatch boundary in src/nlp/nlp.module.ts and src/nlp/nlp-task.service.ts
- [ ] T017 [P] Add Gemini grammar-example generation boundary in src/llm/llm.module.ts and src/llm/grammar-example.service.ts
- [ ] T018 Register Prisma, Config, Storage, NLP, LLM, and common filters/guards in src/app.module.ts

**Checkpoint**: Foundation ready. User story implementation can now begin in priority order or in parallel where capacity allows.

---

## Phase 3: User Story 1 - Synchronize and access learner identity (Priority: P1)

**Goal**: A learner can synchronize identity, retrieve the current profile, and protected profile access rejects invalid sessions.

**Independent Test**: Submit a valid provider identity to `POST /auth/sync`, call `GET /auth/me` with a valid bearer token, repeat sync with changed profile fields, and verify the same learner record is updated without duplicates.

- [ ] T022 [P] [US1] Define sync request and user response Zod schemas in src/auth/auth.schemas.ts
- [ ] T023 [US1] Implement idempotent learner upsert and default group creation in src/auth/auth.service.ts
- [ ] T021 [test] [P] [US1] Add idempotent learner sync service tests in src/auth/auth.service.spec.ts
- [ ] T024 [US1] Implement POST /auth/sync and GET /auth/me controller methods in src/auth/auth.controller.ts
- [ ] T019 [test] [P] [US1] Add contract tests for POST /auth/sync and GET /auth/me in src/auth/auth.contract.spec.ts
- [ ] T020 [test] [P] [US1] Add authorization tests for missing and invalid bearer tokens in src/auth/auth.authz.spec.ts
- [ ] T025 [US1] Wire AuthModule dependencies and exports in src/auth/auth.module.ts

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Organize private study content into groups (Priority: P1)

**Goal**: A learner can list, create, read, and delete private groups while the default group is protected and receives reassigned content.

**Independent Test**: Create a learner, list groups with the default group first, create a new group, read it, delete it, confirm its content moves to the default group, and verify default-group deletion fails.

- [ ] T028 [P] [US2] Create group request and response Zod schemas in src/group/group.schemas.ts
- [ ] T029 [US2] Implement group list, create, read, delete, content count, and reassignment behavior in src/group/group.service.ts
- [ ] T027 [test] [P] [US2] Add private ownership and default group behavior tests in src/group/group.service.spec.ts
- [ ] T030 [US2]  Implement group endpoints in src/group/group.controller.ts
- [ ] T026 [test] [P] [US2] Add contract tests for GET /groups, POST /groups, GET /groups/{groupId}, and DELETE /groups/{groupId} in src/group/group.contract.spec.ts
- [ ] T031 [US2]  Register GroupModule and import it from src/app.module.ts

**Checkpoint**: User Story 2 is fully functional and testable independently.

---

## Phase 5: User Story 3 - Generate study material from Japanese text or files (Priority: P1)

**Goal**: A learner can submit valid text or a supported file, receive an accepted content record, and retrieve completed study material with sentences, grammar examples, and deduplicated vocabulary.

**Independent Test**: Submit one valid text payload or one valid supported file to a learner-owned group, verify `202` pending/processing content, simulate worker callback/result persistence, and retrieve the completed content shape.

- [ ] T035 [P] [US3] Define Zod request/response schemas for POST /content/upload-url and the JSON-based request body for POST /content in src/content/content-ingestion/content-ingestion.schemas.ts, removing all references to multipart/form-data.
- [ ] T036a [US3] Implement ContentIngestionService in src/content/content-ingestion/content-ingestion.service.ts: (1) handle raw text submissions; (2) handle file-based submissions by verifying object metadata (existence, size, type) against the object key passed in the JSON request body using StorageService.
- [ ] T036b [US3] Implement immediate content and job creation in src/content/content-ingestion/content-ingestion.service.ts
- [ ] T036c [US3] Implement Cloud Tasks enqueueing in src/content/content-ingestion/content-ingestion.service.ts
- [ ] T037 [US3] Implement StorageService in src/storage/storage.service.ts: (1) create V4 signed PUT URLs (validating type constraints); (2) verify object existence, size, and content-type in GCS upon POST /content request.
- [ ] T038 [US3] Implement worker result callback persistence and idempotent terminal updates in src/job/job.service.ts
- [ ] T039 [US3] Implement grammar example cache lookup and Gemini cache miss generation in src/llm/grammar-example.service.ts
- [ ] T040 [US3] Implement controller methods in src/content/content.controller.ts: (1) POST /content/upload-url; (2) POST /content (accepting JSON request body only); (3) GET /content/{id}.
- [ ] T032 [test] [P] [US3] Add contract tests for POST /content and GET /content/{id} lifecycle shapes in src/content/content-ingestion/content-ingestion.contract.spec.ts
- [ ] T033 [test] [P] [US3] Add ingestion validation tests for exactly-one-source, file type, file size, and group ownership in src/content/content-ingestion/content-ingestion.spec.ts
- [ ] T041 [US3] Map persisted content into ProcessingContent, FailedContent, and CompletedContent contract shapes in src/content/content.presenter.ts
- [ ] T034 [test] [P] [US3] Add generated result persistence tests for grammar examples and deduplicated vocabulary in src/job/job.service.spec.ts
- [ ] T058 [test] [P] [US3] Add contract tests for POST /content/upload-url, verifying correct signature generation, learner scoping, and content-type validation, in src/content/content-ingestion.contract.spec.ts.

**Checkpoint**: User Story 3 is fully functional and testable independently.

---

## Phase 6: User Story 4 - Track long-running processing (Priority: P2)

**Goal**: A learner can subscribe to authorized SSE status updates until the content reaches a terminal state.

**Independent Test**: Start content processing, subscribe to `GET /content/{id}/status`, update the associated job through pending, processing, and terminal states, and verify emitted SSE payloads include status and progress.

- [ ] T044 [US4] Implement job status registry using per-job BehaviorSubject seeded from persisted ProcessingJob state, completing and evicting the subject on terminal status, in src/job/job-status.service.ts
- [ ] T044a [US4] Register JobStatusService as a provider and export of JobModule in src/job/job.module.ts
- [ ] T045 [US4] Push job lifecycle changes into the corresponding job-status registry subject in src/job/job.service.ts
- [ ] T046 [US4] Implement GET /content/{id}/status SSE endpoint that maps the registry stream to MessageEvents, auto-completes on terminal status, and handles client disconnect cleanup, in src/content/content.controller.ts
- [ ] T042 [test] [P] [US4] Add contract tests for GET /content/{id}/status SSE response shape in src/content/content-status.contract.spec.ts
- [ ] T043 [test] [P] [US4] Add authorization tests for cross-learner status access in src/content/content-status.authz.spec.ts

**Checkpoint**: User Story 4 is fully functional and testable independently.

---

## Phase 7: User Story 5 - Manage existing content (Priority: P2)

**Goal**: A learner can list paginated group content, move content to another owned group, delete content and its job, and remain isolated from other learners' records.

**Independent Test**: Create multiple content records, list a group with pagination, move a content item to another owned group, delete it, and verify cross-learner access, move, status tracking, and deletion are refused.

- [ ] T049 [P] [US5] Add pagination and move-content Zod schemas in src/content/content-management/content-management.schemas.ts
- [ ] T050 [US5] Implement paginated group content listing in src/content/content-management/content-management.service.ts
- [ ] T051 [US5] Implement content move and delete-with-job behavior in src/content/content-management/content-management.service.ts
- [ ] T051a [US5] Register ContentManagementService as a provider and export of ContentModule in src/content/content-management/content-management.module.ts
- [ ] T048 [test] [P] [US5] Add content ownership, pagination, move, and delete service tests in src/content/content-management/content-management.service.spec.ts
- [ ] T051b [US5] Update GroupModule to import ContentModule so GroupController can inject ContentManagementService in src/group/group.module.ts
- [ ] T052 [US5] Add GET /groups/{groupId}/content to GroupController using ContentManagementService in src/group/group.controller.ts
- [ ] T053 [US5] Implement PATCH /content/{id} and DELETE /content/{id} in src/content/content.controller.ts
- [ ] T047 [test] [P] [US5] Add contract tests for GET /groups/{groupId}/content, PATCH /content/{id}, and DELETE /content/{id} in src/content/content-management/content-management.contract.spec.ts

**Checkpoint**: User Story 5 is fully functional and testable independently.

---

<!-- ## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification, documentation, performance, and cleanup across all completed stories.

- [ ] T054 [P] Add end-to-end learner journey covering sync, profile, groups, ingestion, status, retrieval, move, and delete in src/app.e2e-spec.ts
- [ ] T055 [P] Add OpenAPI contract verification test against .agents/specs/openapi.json in src/common/testing/openapi-contract.spec.ts
- [ ] T056 [P] Update quickstart validation notes for implemented environment variables and commands in specs/001-jlpt-backend-api/quickstart.md
- [ ] T057 Run type-check, lint, generated OpenAPI comparison, and Vitest suite for the feature in package.json -->

---

<!-- ## Dependencies & Execution Order
... (rest of the file)
-->
