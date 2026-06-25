# Feature Specification: JLPT Backend API

**Feature Branch**: `develop`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "a nestjs app that inherits current codebase, and strictly implements requirements on ./.agents/specs/openapi.json and ./.agents/specs/draft.md."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Synchronize and access learner identity (Priority: P1)

As a learner who signs in through the client application, I need my account record to be created or updated and then retrievable as my current profile so that all study content is tied to the correct private owner.

**Why this priority**: Every protected learner workflow depends on a stable, authenticated user identity and private ownership boundary.

**Independent Test**: Can be fully tested by submitting a valid sign-in identity, retrieving the current profile, and verifying repeated synchronization updates the same learner record without creating duplicates.

**Acceptance Scenarios**:

1. **Given** a learner identity with a provider and provider account identifier, **When** the client synchronizes the identity, **Then** the system creates or updates one learner profile and returns the current learner details.
2. **Given** a learner with a valid session, **When** the learner requests their profile, **Then** the system returns only that learner's profile.
3. **Given** a missing or invalid session, **When** protected learner information is requested, **Then** the system rejects the request without exposing private data.

---

### User Story 2 - Organize private study content into groups (Priority: P1)

As a learner, I need private groups for organizing generated study materials so that I can keep content separated by class, textbook, exam level, or personal study plan.

**Why this priority**: Group ownership and organization are core to content privacy and navigation across all generated study materials.

**Independent Test**: Can be fully tested by creating a learner, listing the learner's groups, creating a new group, reading a group, deleting a non-default group, and confirming content reassignment behavior.

**Acceptance Scenarios**:

1. **Given** an authenticated learner, **When** they list groups, **Then** the system returns only groups owned by that learner and includes the protected default group first.
2. **Given** an authenticated learner, **When** they create a group with a valid name, **Then** the system adds the group under that learner's private ownership.
3. **Given** a non-default group containing content, **When** the learner deletes the group, **Then** the system reassigns that content to the learner's default group.
4. **Given** the learner's default group, **When** deletion is attempted, **Then** the system rejects the action and preserves the group.

---

### User Story 3 - Generate study material from Japanese text or files (Priority: P1)

As a learner, I need to submit Japanese text or a supported file and receive structured JLPT study material so that I can study translations, sentence-level analysis, grammar patterns, examples, and vocabulary from my own materials.

**Why this priority**: This is the primary user value of the product and the main reason learners use the backend service.

**Independent Test**: Can be fully tested by submitting one valid text input or one valid supported file to a learner-owned group, observing accepted processing, and retrieving the completed study material record.

**Acceptance Scenarios**:

1. **Given** an authenticated learner and a learner-owned group, **When** they submit a title plus Japanese text, **Then** the system accepts the work for processing and returns a pending or processing content record.
2. **Given** an authenticated learner and a learner-owned group, **When** they submit a title plus one supported file, **Then** the system accepts the work for processing and returns a pending or processing content record.
3. **Given** a completed content item, **When** the learner retrieves it, **Then** the system returns the original input reference, overall JLPT level, analyzed sentences, grammar points with examples, and deduplicated vocabulary.
4. **Given** invalid ingestion input with neither text nor file, or with both text and file, **When** the learner submits it, **Then** the system rejects the request with a clear validation error.

---

### User Story 4 - Track long-running processing (Priority: P2)

As a learner, I need live status updates while study material is being generated so that I can see whether the work is pending, processing, completed, or failed without repeatedly guessing the current state.

**Why this priority**: Processing may take long enough that the learner needs visible progress and reliable completion/failure feedback.

**Independent Test**: Can be fully tested by starting content processing, subscribing to status updates for that content, and verifying that status changes and progress are emitted until a terminal state is reached.

**Acceptance Scenarios**:

1. **Given** a learner-owned content item in progress, **When** the learner subscribes to status updates, **Then** the system streams status and progress updates for that item.
2. **Given** processing succeeds, **When** the final update is emitted, **Then** the learner can retrieve the completed content details.
3. **Given** processing fails, **When** the final update is emitted, **Then** the learner can retrieve a failed content record containing a user-readable error message.

---

### User Story 5 - Manage existing content (Priority: P2)

As a learner, I need to list, move, inspect, and delete my saved content so that my study library stays organized and private over time.

**Why this priority**: Once content is generated, learners need lifecycle controls to keep their library useful.

**Independent Test**: Can be fully tested by creating multiple content records, listing a group with pagination, moving a content item to another learner-owned group, deleting it, and verifying inaccessible records are not returned.

**Acceptance Scenarios**:

1. **Given** a learner-owned group with multiple content records, **When** the learner lists group content with pagination settings, **Then** the system returns the requested page and pagination metadata.
2. **Given** a learner-owned content item and another learner-owned group, **When** the learner moves the content, **Then** the content is associated with the target group.
3. **Given** a learner-owned content item, **When** the learner deletes it, **Then** the system removes the content and associated processing record from the learner's library.
4. **Given** content owned by another learner, **When** access, move, status tracking, or deletion is attempted, **Then** the system refuses access.

### Edge Cases

- Missing, invalid, or expired authentication must not reveal whether protected resources exist.
- A learner may have an email, display name, or avatar absent from the upstream identity; synchronization must still work when the provider account identifier is valid.
- Group names must reject invalid or unusable values while allowing normal learner naming needs.
- Default groups cannot be renamed or deleted, and must remain available for content reassignment.
- Content ingestion must reject unsupported file types, files at or above the configured size limit, empty text, and payloads that violate the one-source-only rule.
- Processing must tolerate retries without duplicating user-visible content or generating conflicting terminal results.
- Failed processing must preserve enough information for the learner to understand the failure while preventing leakage of private implementation details.
- Generated study material may include repeated vocabulary or grammar across sentences; learner-facing completed content must present a deduplicated vocabulary list.
- Pagination requests outside available ranges must return a predictable empty or bounded result rather than an error caused by the range itself.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a public health check that reports service availability without requiring learner authentication.
- **FR-002**: System MUST synchronize learner identity records from a trusted sign-in callback using provider and provider account identifier as the stable identity key.
- **FR-003**: System MUST support retrieving the current authenticated learner profile.
- **FR-004**: System MUST require authentication for learner profile, group, content, and status workflows except where the external contract explicitly allows public access.
- **FR-005**: System MUST ensure each learner's groups, content, processing records, and generated study materials are private to that learner.
- **FR-006**: System MUST create and preserve one default group for each learner, return it first in group listings, and prevent deleting or renaming it.
- **FR-007**: System MUST allow authenticated learners to create, list, read, and delete their own non-default groups.
- **FR-008**: System MUST reassign content from a deleted non-default group to the learner's default group.
- **FR-009**: System MUST allow authenticated learners to list content within a learner-owned group using pagination metadata that includes total, page, and limit.
- **FR-010**: System MUST accept content ingestion only when a title, a learner-owned group, and exactly one source are provided: raw Japanese text or one supported file.
- **FR-011**: System MUST support PDF and plain text file inputs up to, but not including, 10 MB.
- **FR-012**: System MUST reject ingestion when both text and file are provided, when neither is provided, when the group is not learner-owned, or when validation fails.
- **FR-013**: System MUST create a pending or processing content record immediately when valid ingestion work is accepted.
- **FR-014**: System MUST process long-running text extraction, linguistic analysis, translation, grammar analysis, vocabulary extraction, and example generation asynchronously.
- **FR-015**: System MUST expose the content lifecycle states PENDING, PROCESSING, COMPLETED, and FAILED exactly as externally specified.
- **FR-016**: System MUST allow learners to retrieve any learner-owned content item in the shape appropriate to its current lifecycle state.
- **FR-017**: System MUST return completed content with original input reference, title, group, creation time, overall JLPT level, sentence analyses, grammar point details, and deduplicated vocabulary.
- **FR-018**: System MUST include Japanese sentence text, translation, JLPT level, grammar points, and similar patterns for each analyzed sentence.
- **FR-019**: System MUST include grammar pattern name, JLPT level, explanation, and exactly three example sentences with translations for each generated grammar point.
- **FR-020**: System MUST include word, reading, JLPT level, translation, synonyms, and example phrases for each generated vocabulary item.
- **FR-021**: System MUST cache generated example sentences for identical grammar patterns to avoid unnecessary duplicate generation and keep repeated results consistent.
- **FR-022**: System MUST allow learners to move learner-owned content to another learner-owned group.
- **FR-023**: System MUST allow learners to delete learner-owned content and the associated processing record.
- **FR-024**: System MUST stream learner-authorized processing status updates that include lifecycle state and progress from 0 through 100 where progress is available.
- **FR-025**: System MUST return failed content with a user-readable error message when processing cannot complete.
- **FR-026**: System MUST distinguish unauthenticated, unauthorized, not found, and validation/business-rule failures using the error categories required by the external contract.
- **FR-027**: System MUST implement the externally observable behavior, schemas, status codes, validation rules, and response shapes defined in `./.agents/specs/openapi.json`.
- **FR-028**: System MUST satisfy the architectural, security, reliability, scalability, persistence, caching, and infrastructure requirements defined in `./.agents/specs/draft.md`.
- **FR-029**: System MUST preserve existing completed behavior from the current backend unless it conflicts with `./.agents/specs/openapi.json` or `./.agents/specs/draft.md`, in which case those requirement files take precedence.

### Key Entities

- **Learner**: Authenticated person using the study platform; identified by an external provider account and represented with profile details such as email, name, and avatar.
- **Group**: Learner-owned organizational container for content; includes a protected default group and learner-created groups.
- **Content**: Learner-owned study material request and result; includes title, group association, input reference, lifecycle status, timestamps, and terminal result or failure details.
- **Processing Job**: Asynchronous work item associated with content generation; tracks lifecycle, progress, retries, and terminal outcome.
- **Sentence Analysis**: Learner-facing analysis of one Japanese sentence, including translation, JLPT level, grammar points, and similar patterns.
- **Grammar Point**: Identified grammar pattern with JLPT level, explanation, and generated examples.
- **Grammar Example**: Japanese example sentence and translation generated for a grammar point.
- **Vocabulary Item**: Deduplicated vocabulary entry with reading, JLPT level, translation, synonyms, and example phrases.
- **Uploaded File**: Learner-provided PDF or plain text source used as intermediate input for text extraction and analysis.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of externally specified required request and response cases in `./.agents/specs/openapi.json` pass contract verification before release.
- **SC-002**: 100% of protected learner workflows reject unauthenticated access and prevent cross-learner access in authorization testing.
- **SC-003**: A learner can synchronize identity, retrieve profile, create a group, submit content, observe processing, retrieve completed study material, move it, and delete it in one end-to-end test flow.
- **SC-004**: At least 95% of valid text submissions up to normal study-note size are accepted for processing and return a pending or processing record within 2 seconds under expected load.
- **SC-005**: At least 95% of valid supported file submissions below 10 MB are accepted for processing and return a pending or processing record within 3 seconds under expected load.
- **SC-006**: Status tracking shows the learner a terminal completed or failed state for 99% of processing jobs without requiring manual intervention.
- **SC-007**: Completed content includes exactly three examples for every generated grammar point in 100% of successful processing results.
- **SC-008**: Vocabulary displayed on a completed content item contains no duplicate vocabulary words within the same content result in 100% of successful processing results.
- **SC-009**: Repeated processing retries do not create duplicate learner-visible content records for the same accepted job in reliability testing.
- **SC-010**: Learners can list and navigate paginated group content with accurate total, page, and limit metadata in 100% of pagination acceptance tests.

## Assumptions

- The external API contract in `./.agents/specs/openapi.json` is the binding source for externally observable behavior.
- The architecture and non-functional requirements in `./.agents/specs/draft.md` are binding unless later superseded by an approved plan.
- The existing backend codebase is the starting point and should be extended in place rather than replaced.
- Authentication is initiated by the client application; the backend is responsible for identity synchronization, session validation for protected workflows, ownership, and data isolation.
- Study content, groups, jobs, and generated results are private by default and never shared across learners.
- The file size rule means supported uploaded files must be smaller than 10 MB.
- Long-running processing may complete outside the learner's current browser session, so content retrieval remains the durable source of truth after completion.
- If a current generated contract in the repository differs from `./.agents/specs/openapi.json`, the `.agents` OpenAPI specification takes precedence for this feature.
