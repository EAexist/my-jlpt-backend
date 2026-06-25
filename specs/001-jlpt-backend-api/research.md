# Research: JLPT Backend API

## Decision: `package.json` is the binding library set

**Rationale**: The user explicitly selected `package.json` as the source of truth. The manifest already contains the required NestJS runtime, Prisma, Google Cloud Tasks, Google Cloud Storage, Gemini, JWT/JWS validation, RxJS, Zod, OpenAPI, and test tooling.

**Alternatives considered**: Adding validation, upload, queue, or auth helper libraries was rejected because it would conflict with the package constraint and is not necessary for the known requirements.

## Decision: Use a minimal NestJS module structure by bounded context

**Rationale**: The current codebase already uses NestJS modules for `auth`, `content`, `health`, and `job`. Planning extends that shape with only the missing bounded contexts required by the spec: groups, storage integration, NLP worker integration, LLM generation, persistence access, and shared request/auth/error utilities.

**Alternatives considered**: A layered enterprise structure with repositories, use-case packages, and domain packages was rejected as premature. A single controller/service pair was rejected because the OpenAPI contract has distinct ownership, ingestion, job, and group responsibilities.

## Decision: Keep `./.agents/specs/openapi.json` as the canonical external contract

**Rationale**: The feature requires strict implementation of that file. Generated TypeScript contracts or Swagger output may be used for verification, but any generated file must be treated as derived from the canonical source.

**Alternatives considered**: Treating `specs/api.ts` or `generated/openapi.json` as canonical was rejected because the user named the `.agents` OpenAPI file as the source of truth and the current generated files may be stale.

## Decision: Use Prisma with PostgreSQL for durable learner, group, content, job, result, and cache state

**Rationale**: Prisma and PostgreSQL are declared in `package.json` and the draft requires NeonDB/PostgreSQL through Prisma. User-private ownership and idempotent async workflows need durable relational records.

**Alternatives considered**: In-memory state was rejected because async jobs and content retrieval must survive process restarts. Adding another database or cache dependency was rejected by the package constraint.

## Decision: Validate request payloads with Zod and contract tests

**Rationale**: Zod is already installed and can express cross-field ingestion rules such as exactly one of text or file. Contract-level tests verify externally observable behavior against `openapi.json`.

**Alternatives considered**: `class-validator`/`class-transformer` were rejected because they are not in `package.json`. Manual ad hoc validation was rejected for cross-field rules and maintainability.

## Decision: Use `jose` for bearer token verification and `google-auth-library` for Google service authentication

**Rationale**: `jose` is declared for JWT/JWS processing, and the draft requires frontend Auth.js session handling with backend validation for protected workflows. `google-auth-library` is present for authenticated service-to-service calls and OIDC/IAM-related interactions.

**Alternatives considered**: Adding `@nestjs/passport`, Passport strategies, or Auth.js server packages was rejected because those packages are not present. Trusting caller-provided identity without token validation was rejected because protected workflows require authentication and private ownership.

## Decision: Use Google Cloud Tasks for async orchestration and Google Cloud Storage for uploaded file handoff

**Rationale**: Both libraries are installed and the draft requires Cloud Tasks and GCS. File extraction and CPU-heavy NLP stay in the private FastAPI worker; NestJS stores files, dispatches tasks, accepts callbacks/results, and manages learner-facing state.

**Alternatives considered**: BullMQ, Redis, Pub/Sub, local queues, or direct synchronous worker calls were rejected because they either add dependencies or conflict with the draft's Cloud Tasks direction.

## Decision: Use RxJS/NestJS streaming support for SSE status updates

**Rationale**: RxJS is present and NestJS supports streaming responses. The OpenAPI contract requires per-content SSE status updates, so the implementation can map persisted job status changes to an event stream without adding packages.

**Alternatives considered**: WebSockets were rejected because the contract specifies SSE. Polling-only status was rejected because the feature requires streaming updates.

## Decision: Use Gemini directly only for backend-owned generation responsibilities

**Rationale**: The draft states the NestJS service directly invokes Gemini for translation based on user preference and exactly three example sentences per grammar pattern. The NLP worker remains responsible for extraction and linguistic analysis.

**Alternatives considered**: Having the NLP worker own all AI generation was rejected because it conflicts with the stated service responsibilities. Adding another LLM SDK was rejected by the package constraint.

## Decision: Context7 unavailable; use local NestJS structure and package declarations as reference

**Rationale**: No Context7 tool is available in this session. The plan therefore uses the existing local NestJS module/controller/service pattern and the installed NestJS packages as the reference for minimal project structure.

**Alternatives considered**: Browsing or adding external documentation dependencies was rejected because the user's core constraint is the local package manifest and no Context7 tool is exposed here.
