# Feature Specification: JLPT Backend API

**Feature Branch**: `develop`

**Created**: 2026-06-23

**Updated**: 2026-07-17

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

**Independent Test**: Can be fully tested by creating a learner, listing the learner's groups, creating a new group, reading a group, deleting a non-default group, and confirming the cascade deletion and trash can recovery behavior.

**Acceptance Scenarios**:

1. **Given** an authenticated learner, **When** they list groups, **Then** the system returns only groups owned by that learner and includes the protected default group first.
2. **Given** an authenticated learner, **When** they create a group with a valid name, **Then** the system adds the group under that learner's private ownership.
3. **Given** a non-default group containing content, **When** the learner deletes the group, **Then** the system cascades the deletion of the group and its contained content, while moving the items to a protected trash container.
4. **Given** the learner's trash container, **When** the learner selects deleted content, **Then** they can either permanently remove the items or restore them to a valid group.
5. **Given** the learner's default group, **When** deletion is attempted, **Then** the system rejects the action and preserves the group.

---

### User Story 3 - Generate study material from Japanese text or files (Priority: P1)

As a learner, I need to submit Japanese text or a supported file and receive structured JLPT study material so that I can study translations, segment-level analysis, grammar patterns, examples, and vocabulary from my own materials.

**Why this priority**: This is the primary user value of the product and the main reason learners use the backend service.

**Independent Test**: Can be fully tested by submitting one valid text input or one valid supported file to a learner-owned group, observing accepted processing, and retrieving the completed study material record.

**Acceptance Scenarios**:

1. **Given** an authenticated learner and a learner-owned group, **When** they submit a title plus Japanese text, **Then** the system accepts the work for processing and returns a pending or processing content record.
2. **Given** an authenticated learner, **When** they request a signed upload URL for a supported file, **Then** the system returns a short-lived signed URL and object key without accepting any file bytes itself.
3. **Given** a learner holding a valid signed upload URL, **When** the client uploads the file directly to the storage bucket and then submits a title plus the resulting object reference to a learner-owned group, **Then** the system accepts the work for processing and returns a pending or processing content record.
4. **Given** a completed content item, **When** the learner retrieves it, **Then** the system returns the title, analyzed segments, and associated grammar patterns and vocabulary derived specifically for each segment.
5. **Given** invalid ingestion input with neither text nor an object reference, or with both text and an object reference, **When** the learner submits it, **Then** the system rejects the request with a clear validation error.
6. **Given** a content submission referencing an object key that was never uploaded, has expired, or does not belong to the requesting learner, **When** the learner submits it, **Then** the system rejects the request without dispatching any processing work.

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

As a learner, I need to list, move, inspect, and delete my saved content so that my study content stays organized and private over time.

**Why this priority**: Once content is generated, learners need lifecycle controls to keep their study content useful.

**Independent Test**: Can be fully tested by creating multiple content records, listing a group with pagination, moving a content item to another learner-owned group, deleting it, and verifying inaccessible records are not returned.

**Acceptance Scenarios**:

1. **Given** a learner-owned group with multiple content records, **When** the learner lists group content with pagination settings, **Then** the system returns the requested page and pagination metadata.
2. **Given** a learner-owned content item and another learner-owned group, **When** the learner moves the content, **Then** the content is associated with the target group.
3. **Given** a learner-owned content item, **When** the learner deletes it, **Then** the system removes the content and associated processing record from the learner's study content.
4. **Given** content owned by another learner, **When** access, move, status tracking, or deletion is attempted, **Then** the system refuses access.

### Edge Cases

- Missing, invalid, or expired authentication must not reveal whether protected resources exist.
- A learner may have an email, display name, or avatar absent from the upstream identity; synchronization must still work when the provider account identifier is valid.
- Group names must reject invalid or unusable values while allowing normal learner naming needs.
- Default groups cannot be renamed or deleted, and must remain available for content reassignment.
- Signed upload URL requests must reject unsupported content types before a URL is ever issued, and issued URLs must expire automatically within a short, bounded window (5-15 minutes).
- Content submissions that reference an object key must be rejected when the object was never uploaded, the signed URL expired before upload completed, or the object key does not belong to the requesting learner.
- The backend must never buffer or stream full file bytes through its own process for learner file uploads; file bytes travel only between the learner's client and the storage bucket.
- Processing must tolerate retries without duplicating user-visible content or generating conflicting terminal results.
- Failed processing must preserve enough information for the learner to understand the failure while preventing leakage of private implementation details.
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
- **FR-010**: System MUST accept content ingestion only when a title, a learner-owned group, and exactly one source are provided: raw Japanese text or a reference to one previously uploaded supported file.
- **FR-010a**: System MUST provide an authenticated endpoint that, given an intended file name and content type, issues a short-lived (5-15 minute) signed URL authorizing a direct `PUT` upload to a specific object path in cloud storage, without accepting or transmitting any file bytes through the backend itself.
- **FR-010b**: System MUST scope every signed upload URL and its resulting object key to the requesting learner, so an object key issued to one learner cannot be referenced or claimed by another learner's content submission.
- **FR-011**: System MUST support PDF and plain text file inputs up to, but not including, 10 MB, validated at the point of signed URL issuance (content type) and again before processing is dispatched (object existence and size).
- **FR-012**: System MUST reject ingestion when both text and a file reference are provided, when neither is provided, when the group is not learner-owned, when the referenced object key was never uploaded or has expired, or when validation fails.
- **FR-013**: System MUST create a pending or processing content record immediately when valid ingestion work is accepted, only after confirming the referenced uploaded object exists and satisfies type and size constraints.
- **FR-015**: System MUST expose the content lifecycle states PENDING, PROCESSING, COMPLETED, and FAILED exactly as externally specified.
- **FR-016**: System MUST allow learners to retrieve any learner-owned content item in the shape appropriate to its current lifecycle state.
- **FR-017**: System MUST return completed content with title, group, creation time, segment analyses (including grammar pattern details and vocabulary items).
- **FR-018**: System MUST include Japanese text, translation and grammar patterns for each analyzed segment, where a segment is a group of 1-3 consecutive original sentences combined to reach a reasonable minimum analysis length (not necessarily a single grammatical sentence).
- **FR-019**: System MUST include grammar pattern name, JLPT level, explanation, and exactly three example sentences with translations for each generated grammar pattern.
- **FR-020**: System MUST include word, reading, JLPT level, and translation for each generated vocabulary item. Synonyms and example phrases SHOULD be included when available but are NOT a release-blocking requirement; guaranteed population of these two fields is a lower-priority future enhancement.
- **FR-021**: System MUST persist generated example sentences for grammar patterns to avoid unnecessary duplicate generation and keep repeated results consistent.
- **FR-022**: System MUST allow learners to move learner-owned content to another learner-owned group.
- **FR-023**: System MUST allow learners to delete learner-owned content and the associated processing record.
- **FR-024**: System MUST stream learner-authorized processing status updates that include lifecycle state of if microservice is processing or completed.
- **FR-024a**: System MUST return the current processing status immediately upon SSE subscription, even if the job already reached a terminal state before the client connected, without querying the NLP worker directly.
- **FR-024b**: System MUST terminate the SSE stream once a terminal lifecycle state (completed or failed) is delivered, rather than holding the connection open indefinitely.
- **FR-025**: System MUST return failed content with a user-readable error message when processing cannot complete.
- **FR-026**: System MUST distinguish unauthenticated, unauthorized, not found, and validation/business-rule failures using the error categories required by the external contract.
- **FR-027**: System MUST implement the externally observable behavior, schemas, status codes, validation rules, and response shapes defined in `./.agents/specs/openapi.json`.

### Key Entities

- **Learner**: Authenticated person using the study platform; identified by an external provider account and represented with profile details such as email, name, and avatar.
- **Group**: Learner-owned organizational container for content; includes a protected default group and learner-created groups.
- **Content**: Learner-owned study material request and result; includes title, group association, input reference, lifecycle status, timestamps, and terminal result or failure details.
- **Processing Job**: Asynchronous work item associated with content generation; tracks lifecycle, progress, retries, and terminal outcome.
- **Segment Analysis**: Learner-facing analysis of one text segment — a group of 1-3 consecutive original sentences combined to reach a reasonable minimum analysis length — including translation, JLPT level, and grammar points.
- **Grammar Pattern**: Identified grammar pattern with JLPT level, explanation, and generated examples.
- **Grammar Example**: Japanese example sentence and translation generated for a grammar pattern.
- **Vocabulary Item**: Deduplicated vocabulary entry with reading, JLPT level, and translation; synonyms and example phrases are optional fields, populated as a future enhancement rather than a current guarantee.
- **Uploaded File**: Learner-provided PDF or plain text source uploaded directly from the client to cloud storage via a backend-issued signed URL, then referenced by object key as intermediate input for text extraction and analysis; the backend never receives the file bytes directly.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of externally specified required request and response cases in `./.agents/specs/openapi.json` pass contract verification before release.
- **SC-002**: 100% of protected learner workflows reject unauthenticated access and prevent cross-learner access in authorization testing.
- **SC-003**: A learner can synchronize identity, retrieve profile, create a group, submit content, observe processing, retrieve completed study material, move it, and delete it in one end-to-end test flow.
- **SC-004**: At least 95% of valid text submissions up to normal study-note size are accepted for processing and return a pending or processing record within 2 seconds under expected load.
- **SC-005**: At least 95% of valid supported file submissions below 10 MB are accepted for processing and return a pending or processing record within 3 seconds under expected load, measured from the object-reference submission step (after the client's direct upload to storage completes).
- **SC-005a**: 100% of file bytes for learner uploads travel directly between the client and cloud storage; zero requests in ingestion testing show the backend process buffering or streaming full file contents.
- **SC-006**: Status tracking shows the learner a terminal completed or failed state for 99% of processing jobs without requiring manual intervention.
- **SC-007**: Completed content includes exactly three examples for every generated grammar pattern in 100% of successful processing results.
- **SC-008**: Vocabulary displayed on a completed content item contains no duplicate vocabulary words within the same content result in 100% of successful processing results.
- **SC-009**: Repeated processing retries do not create duplicate learner-visible content records for the same accepted job in reliability testing.
- **SC-010**: Learners can list and navigate paginated group content with accurate total, page, and limit metadata in 100% of pagination acceptance tests.

## Assumptions

- The external API contract in `./.agents/specs/openapi.json` is the binding source for externally observable behavior.
- The existing backend codebase is the starting point and should be extended in place rather than replaced.
- Authentication is initiated by the client application; the backend is responsible for identity synchronization, session validation for protected workflows, ownership, and data isolation.
- Study content, groups, jobs, and generated results are private by default and never shared across learners.
- File uploads use a pre-signed URL handoff: the client requests a signed URL from the backend, uploads the file directly to cloud storage, and only then submits content referencing the resulting object key; the backend acts solely as an authorizer and never proxies raw file bytes.
- Long-running processing may complete outside the learner's current browser session, so content retrieval remains the durable source of truth after completion.
- If a current generated contract in the repository differs from `./.agents/specs/openapi.json`, the `.agents` OpenAPI specification takes precedence for this feature.