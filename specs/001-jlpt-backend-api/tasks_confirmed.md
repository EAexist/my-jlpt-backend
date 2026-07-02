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
- [ ] T003 [P] Add API base path `/api/v1`, global config loading, and validation plumbing in src/main.ts
- [ ] T004 [P] Define required environment variables and defaults in src/common/config/env.schema.ts
- [ ] T005 [P] Add shared API response/error constants matching ApiError in src/common/api/api-error.ts
- [ ] T006 [P] Create reusable test application bootstrap helpers in src/common/testing/app-test-utils.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core persistence, authentication, ownership, validation, and integration boundaries required before any story can be completed.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T007 Define Prisma models and enums for Learner, Group, Content, ProcessingJob, SentenceAnalysis, GrammarPoint, GrammarExample, GrammarExampleCache, VocabularyItem, and UploadedFile in prisma/schema.prisma
- [ ] T008 Generate Prisma migration for the JLPT data model in prisma/migrations/001_jlpt_backend_api/migration.sql
- [ ] T009 [P] Add PrismaModule and PrismaService lifecycle management in src/prisma/prisma.module.ts and src/prisma/prisma.service.ts
- [ ] T010 [P] Add current learner request type and decorator in src/auth/current-learner.decorator.ts
- [ ] T011 [P] Implement bearer token verification with jose in src/auth/bearer-auth.guard.ts
- [ ] T012 [P] Implement ownership and resource error helpers in src/auth/ownership.service.ts
- [ ] T013 [P] Implement Zod validation pipe and exception mapping in src/common/validation/zod-validation.pipe.ts
- [ ] T014 [P] Implement centralized ApiError exception filter in src/common/filters/api-error.filter.ts
- [ ] T015 [P] Add GCS upload boundary in src/storage/storage.module.ts and src/storage/storage.service.ts
- [ ] T016 [P] Add Cloud Tasks dispatch boundary in src/nlp/nlp.module.ts and src/nlp/nlp-task.service.ts
- [ ] T017 [P] Add Gemini grammar-example generation boundary in src/llm/llm.module.ts and src/llm/grammar-example.service.ts
- [ ] T018 Register Prisma, Config, Storage, NLP, LLM, and common filters/guards in src/app.module.ts

**Checkpoint**: Foundation ready. User story implementation can now begin in priority order or in parallel where capacity allows.

---

## Phase 3: User Story 1 - Synchronize and access learner identity (Priority: P1) MVP

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
- [ ] T030 [US2] Implement group endpoints in src/group/group.controller.ts
- [ ] T026 [test] [P] [US2] Add contract tests for GET /groups, POST /groups, GET /groups/{groupId}, and DELETE /groups/{groupId} in src/group/group.contract.spec.ts
- [ ] T031 [US2] Register GroupModule and import it from src/app.module.ts

**Checkpoint**: User Story 2 is fully functional and testable independently.

---

## Phase 5: User Story 3 - Generate study material from Japanese text or files (Priority: P1)

**Goal**: A learner can submit valid text or a supported file, receive an accepted content record, and retrieve completed study material with sentences, grammar examples, and deduplicated vocabulary.

**Independent Test**: Submit one valid text payload or one valid supported file to a learner-owned group, verify `202` pending/processing content, simulate worker callback/result persistence, and retrieve the completed content shape.

- [ ] T035 [P] [US3] Replace content DTOs with multipart and response Zod schemas in src/content/content.schemas.ts
- [ ] T036 [US3] Implement text/file ingestion, immediate content/job creation, and Cloud Tasks enqueueing in src/content/content.service.ts
- [ ] T037 [US3] Implement GCS upload validation for PDF and text files under 10 MB in src/storage/storage.service.ts
- [ ] T038 [US3] Implement worker result callback persistence and idempotent terminal updates in src/job/job.service.ts
- [ ] T039 [US3] Implement grammar example cache lookup and Gemini cache miss generation in src/llm/grammar-example.service.ts
- [ ] T040 [US3] Implement POST /content multipart handling and GET /content/{id} in src/content/content.controller.ts
- [ ] T032 [test] [P] [US3] Add contract tests for POST /content and GET /content/{id} lifecycle shapes in src/content/content.contract.spec.ts
- [ ] T033 [test] [P] [US3] Add ingestion validation tests for exactly-one-source, file type, file size, and group ownership in src/content/content.ingestion.spec.ts
- [ ] T041 [US3] Map persisted content into ProcessingContent, FailedContent, and CompletedContent contract shapes in src/content/content.presenter.ts
- [ ] T034 [test] [P] [US3] Add generated result persistence tests for grammar examples and deduplicated vocabulary in src/content/content-results.service.spec.ts

**Checkpoint**: User Story 3 is fully functional and testable independently.

---

## Phase 6: User Story 4 - Track long-running processing (Priority: P2)

**Goal**: A learner can subscribe to authorized SSE status updates until the content reaches a terminal state.

**Independent Test**: Start content processing, subscribe to `GET /content/{id}/status`, update the associated job through pending, processing, and terminal states, and verify emitted SSE payloads include status and progress.

- [ ] T044 [US4] Implement job status observable registry backed by persisted ProcessingJob state in src/job/job-status.service.ts
- [ ] T045 [US4] Emit status updates from job lifecycle changes in src/job/job.service.ts
- [ ] T046 [US4] Implement GET /content/{id}/status SSE endpoint in src/content/content.controller.ts
- [ ] T042 [test] [P] [US4] Add contract tests for GET /content/{id}/status SSE response shape in src/content/content-status.contract.spec.ts
- [ ] T043 [test] [P] [US4] Add authorization tests for cross-learner status access in src/content/content-status.authz.spec.ts

**Checkpoint**: User Story 4 is fully functional and testable independently.

---

## Phase 7: User Story 5 - Manage existing content (Priority: P2)

**Goal**: A learner can list paginated group content, move content to another owned group, delete content and its job, and remain isolated from other learners' records.

**Independent Test**: Create multiple content records, list a group with pagination, move a content item to another owned group, delete it, and verify cross-learner access, move, status tracking, and deletion are refused.

- [ ] T049 [P] [US5] Add pagination and move-content Zod schemas in src/content/content-management.schemas.ts
- [ ] T050 [US5] Implement paginated group content listing in src/content/content.service.ts
- [ ] T051 [US5] Implement content move and delete-with-job behavior in src/content/content.service.ts
- [ ] T048 [test] [P] [US5] Add content ownership, pagination, move, and delete service tests in src/content/content-management.service.spec.ts
- [ ] T052 [US5] Add GET /groups/{groupId}/content to GroupController using ContentService in src/group/group.controller.ts
- [ ] T053 [US5] Implement PATCH /content/{id} and DELETE /content/{id} in src/content/content.controller.ts
- [ ] T047 [test] [P] [US5] Add contract tests for GET /groups/{groupId}/content, PATCH /content/{id}, and DELETE /content/{id} in src/content/content-management.contract.spec.ts

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

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. Can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. Blocks all user stories.
- **User Stories (Phase 3+)**: All depend on Foundational completion.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundation. Required for authenticated ownership in later stories.
- **US2 (P1)**: Starts after Foundation. Uses authenticated learner identity and default group rules from US1.
- **US3 (P1)**: Starts after Foundation and needs learner-owned groups from US2 for full acceptance testing.
- **US4 (P2)**: Starts after US3 because it streams content/job status created by ingestion.
- **US5 (P2)**: Starts after US2 and US3 because it manages existing groups and content.

### Parallel Opportunities

- Setup tasks T002-T006 can run in parallel after T001 is understood.
- Foundational tasks T009-T017 can run in parallel after T007-T008 define the persistence model.
- US1 tests T019-T021 can run in parallel before implementation.
- US2 tests T026-T027 and schema task T028 can run in parallel.
- US3 tests T032-T034 can run in parallel; storage T037 and LLM T039 can proceed in parallel with content service work once interfaces are known.
- US4 tests T042-T043 can run in parallel before the SSE implementation.
- US5 tests T047-T048 and schema task T049 can run in parallel.
- Polish verification tasks T054-T056 can run in parallel before final validation T057.

---

## Parallel Example: User Story 1

```text
Task: "T019 [P] [US1] Add contract tests for POST /auth/sync and GET /auth/me in src/auth/auth.contract.spec.ts"
Task: "T020 [P] [US1] Add authorization tests for missing and invalid bearer tokens in src/auth/auth.authz.spec.ts"
Task: "T021 [P] [US1] Add idempotent learner sync service tests in src/auth/auth.service.spec.ts"
```

## Parallel Example: User Story 3

```text
Task: "T032 [P] [US3] Add contract tests for POST /content and GET /content/{id} lifecycle shapes in src/content/content.contract.spec.ts"
Task: "T033 [P] [US3] Add ingestion validation tests for exactly-one-source, file type, file size, and group ownership in src/content/content.ingestion.spec.ts"
Task: "T034 [P] [US3] Add generated result persistence tests for grammar examples and deduplicated vocabulary in src/content/content-results.service.spec.ts"
Task: "T037 [US3] Implement GCS upload validation for PDF and text files under 10 MB in src/storage/storage.service.ts"
Task: "T039 [US3] Implement grammar example cache lookup and Gemini cache miss generation in src/llm/grammar-example.service.ts"
```

## Parallel Example: User Story 5

```text
Task: "T047 [P] [US5] Add contract tests for GET /groups/{groupId}/content, PATCH /content/{id}, and DELETE /content/{id} in src/content/content-management.contract.spec.ts"
Task: "T048 [P] [US5] Add content ownership, pagination, move, and delete service tests in src/content/content-management.service.spec.ts"
Task: "T049 [P] [US5] Add pagination and move-content Zod schemas in src/content/content-management.schemas.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Stop and validate identity sync, current profile retrieval, and auth rejection.

### Contract-Useful First Release

1. Complete Setup and Foundation.
2. Deliver US1, US2, and US3 because all are P1 and together cover authenticated identity, organization, and content generation.
3. Validate against `.agents/specs/openapi.json` before adding P2 workflows.

### Incremental Delivery

1. Add US4 for live processing visibility.
2. Add US5 for content library lifecycle management.
3. Finish Polish tasks and run the quickstart validation commands.

## Phase 9: Convergence

- [ ] T058 Implement idempotent learner sync, current profile retrieval, bearer auth plumbing, and protected workflow enforcement per US1/AC1-AC3 and FR-002-FR-004 (missing)
- [ ] T059 Add Prisma models, migration, PrismaService lifecycle, and ownership/default-group persistence for learner-private groups, content, jobs, generated material, uploaded files, and grammar example cache per FR-005-FR-006 and plan: data model (missing)
- [ ] T060 Align global route prefix and public health endpoint with `/api/v1/health` returning the OpenAPI `{ status: "ok" }` shape per FR-001 and FR-027 (partial)
- [ ] T061 Replace group scaffold with `/groups` and `/groups/{groupId}` contract behavior including learner ownership, default group first, valid names, default deletion protection, and content reassignment per US2/AC1-AC4 and FR-006-FR-008 (partial)
- [ ] T062 Replace content scaffold with multipart text/file ingestion, exactly-one-source validation, learner-owned group validation, immediate pending/processing content and job creation, lifecycle states, completed/failed presenters, and worker callback persistence per US3/AC1-AC4 and FR-010-FR-020,FR-025 (partial)
- [ ] T063 Implement GCS upload, Cloud Tasks dispatch with private worker authentication assumptions, and Gemini grammar-example service boundaries per FR-014, FR-028, and plan: storage/nlp/llm integration (missing)
- [ ] T064 Implement grammar example cache lookup/persistence and exactly three generated examples per grammar point per FR-019, FR-021, and SC-007 (missing)
- [ ] T065 Implement authorized `GET /content/{id}/status` SSE streaming, persisted ProcessingJob status registry, lifecycle update emission, and progress 0-100 handling per US4/AC1-AC3 and FR-024 (missing)
- [ ] T066 Implement paginated group content listing, content move to another owned group, delete-with-job behavior, and cross-learner refusal per US5/AC1-AC4 and FR-009,FR-022-FR-023 (missing)
- [ ] T067 Add shared ApiError response constants, centralized exception filter, Zod validation pipe, and status/error category mapping for unauthenticated, unauthorized, not found, and validation/business-rule failures per FR-026-FR-027 (missing)
- [ ] T068 Add contract, authorization, service, and end-to-end tests covering OpenAPI required cases, private ownership, identity-to-delete learner journey, pagination metadata, and generated result invariants per SC-001-SC-003 and SC-010 (missing)
- [ ] T069 Update OpenAPI generation/comparison tooling so generated output is checked against `.agents/specs/openapi.json` before release per SC-001 and plan: contract fidelity (missing)
- [ ] T070 Review scaffold public endpoints and modules not present in the OpenAPI contract, removing or explicitly justifying non-contract behavior per FR-027 and FR-029 (unrequested) -->
