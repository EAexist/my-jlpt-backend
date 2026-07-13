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
- `POST /content/upload-url`
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
- `UploadUrlRequest`
- `UploadUrlResponse`

## Internal architecture note (does not change the external contract)

As of this revision, `GrammarPoint` and `GrammarExample` data returned under `Content`/`Sentence` responses are produced by this service's Gemini-backed `llm` module, not by the external NLP worker. The external NLP worker is now scoped to text chunking and dictionary-matched vocabulary extraction only. The OpenAPI shape of `GrammarPoint`, `GrammarExample`, `Sentence`, and `VocabularyItem` is unchanged by this internal shift — only where the data originates changes.

## Upload architecture note (changes the external contract)

As of this revision, file ingestion is a two-step, externally observable flow rather than a single multipart request:

1. `POST /content/upload-url` — the learner supplies an intended file name and content type (`UploadUrlRequest`) and receives a short-lived (5-15 minute) signed URL, an `objectKey`, and an expiry (`UploadUrlResponse`). This endpoint accepts no file body.
2. The client performs a direct `PUT` of the file to the returned signed URL, bypassing this service entirely.
3. `POST /content` — for file-based submissions, the request body now carries a reference to the uploaded object (`objectKey`, `fileName`, `mimeType`) instead of a multipart file attachment. The endpoint no longer accepts `multipart/form-data` file uploads.

This is a breaking change to the previous `POST /content` file-upload request shape and must be reflected as such in `./.agents/specs/openapi.json` and any generated client/server code. `BaseContent`'s `inputFileObjectKey`, `inputFileName`, and `inputMimeType` response fields are unchanged in shape; only how they are populated changes.

## Contract rules

- Do not treat `specs/api.ts` or `generated/openapi.json` as the source of truth unless regenerated from `./.agents/specs/openapi.json`.
- Contract tests must verify status codes, required fields, lifecycle polymorphism, authentication behavior, group ownership behavior, ingestion validation, SSE status shape, signed-URL issuance (expiry, content-type validation, learner scoping), and rejection of `POST /content` submissions referencing an unuploaded, expired, or another learner's object key.
- If implementation and generated docs differ, update implementation or generation so the public behavior matches `./.agents/specs/openapi.json`.