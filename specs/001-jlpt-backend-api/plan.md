# Implementation Plan: JLPT Backend API

**Branch**: `develop` | **Date**: 2026-06-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-jlpt-backend-api/spec.md`

## Summary

Implement the JLPT Study Material Generator backend by extending the current NestJS codebase in place and making `./.agents/specs/openapi.json` the binding external API contract. The backend remains a minimal modular NestJS web service: health, auth, groups, content, jobs, storage, processing orchestration, and generated-study-material persistence. `package.json` is the source of truth for allowed libraries; planning uses only dependencies already declared there.

## Technical Context

**Language/Version**: TypeScript 5.7.x on Node.js 22 types

**Primary Dependencies**: NestJS 11 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/config`, `@nestjs/swagger`), Prisma 6, `@google-cloud/tasks`, `@google-cloud/storage`, `google-auth-library`, `@google/genai`, `jose`, RxJS, Zod

**Storage**: PostgreSQL through Prisma; Google Cloud Storage for intermediate uploaded files; generated grammar-example cache persisted in PostgreSQL

**Testing**: Vitest, `@nestjs/testing`, Supertest, TypeScript type-checking, generated OpenAPI verification

**Target Platform**: HTTP web service deployed to Google Cloud Run, with private service-to-service communication to the NLP worker

**Project Type**: Backend web service / API orchestrator

**Performance Goals**: Accept 95% of valid text submissions within 2 seconds and valid supported file submissions within 3 seconds under expected load; stream terminal status for 99% of jobs without manual intervention

**Constraints**: Must implement `./.agents/specs/openapi.json` exactly for observable API behavior; must satisfy `./.agents/specs/draft.md`; must not add libraries outside `package.json`; file inputs are PDF or plain text and must be smaller than 10 MB; CPU-intensive extraction and NLP analysis stay outside the NestJS service

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
|-- content/
|-- job/
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
