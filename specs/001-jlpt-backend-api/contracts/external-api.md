# External API Contract

The canonical contract for this feature is:

```text
./.agents/specs/openapi.json
```

Implementation must conform to that file for all externally observable behavior. This document is a planning index so downstream tasks do not create a competing contract.

## Server

- Base path: `/api/v1`
- Public health endpoint: `/health` as specified by the OpenAPI contract
- Default security: bearer token unless the operation explicitly overrides security

## Required endpoint groups

- `GET /health`
- `POST /auth/sync`
- `GET /auth/me`
- `GET /groups`
- `POST /groups`
- `GET /groups/{groupId}`
- `DELETE /groups/{groupId}`
- `GET /groups/{groupId}/content`
- `POST /content`
- `GET /content/{id}`
- `PATCH /content/{id}`
- `DELETE /content/{id}`
- `GET /content/{id}/status`

## Required schema groups

- `ApiError`
- `User`
- `Group`
- `JLPTLevel`
- `GrammarExample`
- `GrammarPoint`
- `VocabularyItem`
- `Sentence`
- `BaseContent`
- `ProcessingContent`
- `FailedContent`
- `CompletedContent`
- `Content`

## Contract rules

- Do not treat `specs/api.ts` or `generated/openapi.json` as the source of truth unless regenerated from `./.agents/specs/openapi.json`.
- Contract tests must verify status codes, required fields, lifecycle polymorphism, authentication behavior, group ownership behavior, ingestion validation, and SSE status shape.
- If implementation and generated docs differ, update implementation or generation so the public behavior matches `./.agents/specs/openapi.json`.
