# Tasks: JLPT Backend API

**Input**: Design documents from `/specs/001-jlpt-backend-api/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/external-api.md, quickstart.md
**Tests**: Included because the specification requires contract verification, authorization testing, and an end-to-end flow.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it targets different files or has no dependency on incomplete tasks
- **[Story]**: Maps to user stories from `spec.md`
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the existing NestJS project for contract-bound implementation.

<!-- - [ ] T001 Fix malformed JSON in canonical OpenAPI contract so tooling can parse it in .agents/specs/openapi.json
- [ ] T002 [P] Add generated OpenAPI comparison helper for .agents/specs/openapi.json in scripts/generate-openapi.ts -->
- [ ] T003a [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/introduction.md] Add API base path `/api/v1` in src/main.ts
- [ ] T003b [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/configuration.md] Add global config loading in src/main.ts
- [ ] T003c [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/pipes.md] Add validation plumbing in src/main.ts
- [ ] T004 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/configuration.md] Define required environment variables and defaults in src/common/config/env.schema.ts
- [ ] T005 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/exception-filters.md] Add shared API response/error constants matching ApiError in src/common/api/api-error.ts
- [ ] T006 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Create reusable test application bootstrap helpers in src/common/testing/app-test-utils.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence, authentication, ownership, validation, and integration boundaries required before any story can be completed.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 [docs|.standard-codes/ref-repos/docs.nestjs/content/recipes/prisma.md] Define Prisma models and enums for Learner, Group, Content, ProcessingJob, SentenceAnalysis, GrammarPoint, GrammarExample, GrammarExampleCache, VocabularyItem, and UploadedFile in prisma/schema.prisma
- [ ] T008 [docs|.standard-codes/ref-repos/docs.nestjs/content/recipes/prisma.md] Generate Prisma migration for the JLPT data model in prisma/migrations/001_jlpt_backend_api/migration.sql
- [ ] T009 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/recipes/prisma.md] Add PrismaModule and PrismaService lifecycle management in src/prisma/prisma.module.ts and src/prisma/prisma.service.ts
- [ ] T010 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/custom-decorators.md] Add current learner request type and decorator in src/auth/current-learner.decorator.ts
- [ ] T011 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/security/authentication.md] Implement bearer token verification with jose in src/auth/bearer-auth.guard.ts
- [ ] T012 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/security/authorization.md] Implement ownership and resource error helpers in src/auth/ownership.service.ts
- [ ] T013 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/pipes.md] Implement Zod validation pipe and exception mapping in src/common/validation/zod-validation.pipe.ts
- [ ] T014 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/exception-filters.md] Implement centralized ApiError exception filter in src/common/filters/api-error.filter.ts
- [ ] T015 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/file-upload.md] Add GCS upload boundary in src/storage/storage.module.ts and src/storage/storage.service.ts
- [ ] T016 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/queues.md] Add Cloud Tasks dispatch boundary in src/nlp/nlp.module.ts and src/nlp/nlp-task.service.ts
- [ ] T017 [P] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Add Gemini grammar-example generation boundary in src/llm/llm.module.ts and src/llm/grammar-example.service.ts
- [ ] T018 [docs|.standard-codes/ref-repos/docs.nestjs/content/modules.md] Register Prisma, Config, Storage, NLP, LLM, and common filters/guards in src/app.module.ts

**Checkpoint**: Foundation ready. User story implementation can now begin in priority order or in parallel where capacity allows.

---

## Phase 3: User Story 1 - Synchronize and access learner identity (Priority: P1) MVP

**Goal**: A learner can synchronize identity, retrieve the current profile, and protected profile access rejects invalid sessions.

**Independent Test**: Submit a valid provider identity to `POST /auth/sync`, call `GET /auth/me` with a valid bearer token, repeat sync with changed profile fields, and verify the same learner record is updated without duplicates.

- [ ] T022 [P] [US1] [docs|.standard-codes/ref-repos/docs.nestjs/content/openapi/mapped-types.md] Define sync request and user response Zod schemas in src/auth/auth.schemas.ts
- [ ] T023 [US1] [docs|.standard-codes/ref-repos/docs.nestjs/content/security/authentication.md] Implement idempotent learner upsert and default group creation in src/auth/auth.service.ts
- [ ] T021 [test] [P] [US1] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add idempotent learner sync service tests in src/auth/auth.service.spec.ts
- [ ] T024 [US1] [docs|.standard-codes/ref-repos/docs.nestjs/content/controllers.md] Implement POST /auth/sync and GET /auth/me controller methods in src/auth/auth.controller.ts
- [ ] T019 [test] [P] [US1] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add contract tests for POST /auth/sync and GET /auth/me in src/auth/auth.contract.spec.ts
- [ ] T020 [test] [P] [US1] [docs|.standard-codes/ref-repos/docs.nestjs/content/security/authorization.md] Add authorization tests for missing and invalid bearer tokens in src/auth/auth.authz.spec.ts
- [ ] T025 [US1] [docs|.standard-codes/ref-repos/docs.nestjs/content/modules.md] Wire AuthModule dependencies and exports in src/auth/auth.module.ts

**Checkpoint**: User Story 1 is fully functional and testable independently.

---

## Phase 4: User Story 2 - Organize private study content into groups (Priority: P1)

**Goal**: A learner can list, create, read, and delete private groups while the default group is protected and receives reassigned content.

**Independent Test**: Create a learner, list groups with the default group first, create a new group, read it, delete it, confirm its content moves to the default group, and verify default-group deletion fails.

- [ ] T028 [P] [US2] [docs|.standard-codes/ref-repos/docs.nestjs/content/openapi/mapped-types.md] Create group request and response Zod schemas in src/group/group.schemas.ts
- [ ] T029 [US2] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Implement group list, create, read, delete, content count, and reassignment behavior in src/group/group.service.ts
- [ ] T027 [test] [P] [US2] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add private ownership and default group behavior tests in src/group/group.service.spec.ts
- [ ] T030 [US2] [docs|.standard-codes/ref-repos/docs.nestjs/content/controllers.md] Implement group endpoints in src/group/group.controller.ts
- [ ] T026 [test] [P] [US2] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add contract tests for GET /groups, POST /groups, GET /groups/{groupId}, and DELETE /groups/{groupId} in src/group/group.contract.spec.ts
- [ ] T031 [US2] [docs|.standard-codes/ref-repos/docs.nestjs/content/modules.md] Register GroupModule and import it from src/app.module.ts

**Checkpoint**: User Story 2 is fully functional and testable independently.

---

## Phase 5: User Story 3 - Generate study material from Japanese text or files (Priority: P1)

**Goal**: A learner can submit valid text or a supported file, receive an accepted content record, and retrieve completed study material with sentences, grammar examples, and deduplicated vocabulary.

**Independent Test**: Submit one valid text payload or one valid supported file to a learner-owned group, verify `202` pending/processing content, simulate worker callback/result persistence, and retrieve the completed content shape.

- [ ] T035 [P] [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/openapi/mapped-types.md] Replace content DTOs with multipart and response Zod schemas in src/content/content.schemas.ts
- [ ] T036a [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/file-upload.md] Implement text/file ingestion logic
- [ ] T036b [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Implement immediate content and job creation
- [ ] T036c [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/queues.md] Implement Cloud Tasks enqueueing in src/content/content.service.ts
- [ ] T037 [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/file-upload.md] Implement GCS upload validation for PDF and text files under 10 MB in src/storage/storage.service.ts
- [ ] T038 [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Implement worker result callback persistence and idempotent terminal updates in src/job/job.service.ts
- [ ] T039 [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Implement grammar example cache lookup and Gemini cache miss generation in src/llm/grammar-example.service.ts
- [ ] T040 [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/controllers.md] Implement POST /content multipart handling and GET /content/{id} in src/content/content.controller.ts
- [ ] T032 [test] [P] [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add contract tests for POST /content and GET /content/{id} lifecycle shapes in src/content/content.contract.spec.ts
- [ ] T033 [test] [P] [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add ingestion validation tests for exactly-one-source, file type, file size, and group ownership in src/content/content.ingestion.spec.ts
- [ ] T041 [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/serialization.md] Map persisted content into ProcessingContent, FailedContent, and CompletedContent contract shapes in src/content/content.presenter.ts
- [ ] T034 [test] [P] [US3] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add generated result persistence tests for grammar examples and deduplicated vocabulary in src/content/content-results.service.spec.ts

**Checkpoint**: User Story 3 is fully functional and testable independently.

---

## Phase 6: User Story 4 - Track long-running processing (Priority: P2)

**Goal**: A learner can subscribe to authorized SSE status updates until the content reaches a terminal state.

**Independent Test**: Start content processing, subscribe to `GET /content/{id}/status`, update the associated job through pending, processing, and terminal states, and verify emitted SSE payloads include status and progress.

- [ ] T044 [US4] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Implement job status observable registry backed by persisted ProcessingJob state in src/job/job-status.service.ts
- [ ] T045 [US4] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/events.md] Emit status updates from job lifecycle changes in src/job/job.service.ts
- [ ] T046 [US4] [docs|.standard-codes/ref-repos/docs.nestjs/content/techniques/server-sent-events.md] Implement GET /content/{id}/status SSE endpoint in src/content/content.controller.ts
- [ ] T042 [test] [P] [US4] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add contract tests for GET /content/{id}/status SSE response shape in src/content/content-status.contract.spec.ts
- [ ] T043 [test] [P] [US4] [docs|.standard-codes/ref-repos/docs.nestjs/content/security/authorization.md] Add authorization tests for cross-learner status access in src/content/content-status.authz.spec.ts

**Checkpoint**: User Story 4 is fully functional and testable independently.

---

## Phase 7: User Story 5 - Manage existing content (Priority: P2)

**Goal**: A learner can list paginated group content, move content to another owned group, delete content and its job, and remain isolated from other learners' records.

**Independent Test**: Create multiple content records, list a group with pagination, move a content item to another owned group, delete it, and verify cross-learner access, move, status tracking, and deletion are refused.

- [ ] T049 [P] [US5] [docs|.standard-codes/ref-repos/docs.nestjs/content/openapi/mapped-types.md] Add pagination and move-content Zod schemas in src/content/content-management.schemas.ts
- [ ] T050 [US5] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Implement paginated group content listing in src/content/content.service.ts
- [ ] T051 [US5] [docs|.standard-codes/ref-repos/docs.nestjs/content/components.md] Implement content move and delete-with-job behavior in src/content/content.service.ts
- [ ] T048 [test] [P] [US5] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add content ownership, pagination, move, and delete service tests in src/content/content-management.service.spec.ts
- [ ] T052 [US5] [docs|.standard-codes/ref-repos/docs.nestjs/content/controllers.md] Add GET /groups/{groupId}/content to GroupController using ContentService in src/group/group.controller.ts
- [ ] T053 [US5] [docs|.standard-codes/ref-repos/docs.nestjs/content/controllers.md] Implement PATCH /content/{id} and DELETE /content/{id} in src/content/content.controller.ts
- [ ] T047 [test] [P] [US5] [docs|.standard-codes/ref-repos/docs.nestjs/content/fundamentals/unit-testing.md] Add contract tests for GET /groups/{groupId}/content, PATCH /content/{id}, and DELETE /content/{id} in src/content/content-management.contract.spec.ts

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
