# Quickstart: JLPT Backend API

## Prerequisites

- Node.js compatible with the project TypeScript and NestJS versions
- Dependencies installed from `package-lock.json`
- PostgreSQL connection string in `DATABASE_URL`
- Environment values for bearer token verification, Google Cloud Tasks, Google Cloud Storage, Gemini, and the private NLP worker callback/dispatch flow

## Setup

```powershell
npm install
npx prisma generate
```

If database migrations have been created for the feature, apply them before validation:

```powershell
npx prisma migrate dev
```

## Static validation

```powershell
npm run type-check
npm run lint
npm run generate:openapi
```

Expected outcome:

- TypeScript succeeds.
- Lint succeeds or reports only actionable formatting/code issues.
- Generated OpenAPI output matches `./.agents/specs/openapi.json` for externally observable operations and schemas.

## Test validation

```powershell
npm test
```

Expected coverage:

- Public health check returns service availability.
- Identity sync is idempotent.
- Protected routes reject missing or invalid bearer tokens.
- Learners cannot access another learner's groups, content, jobs, or status stream.
- Default group behavior is enforced.
- Content ingestion enforces title, learner-owned group, exactly one source, supported file type, and file size limit.
- Accepted content returns a pending or processing record.
- Content lifecycle responses match pending, processing, completed, and failed states.
- SSE status responses match the contract shape.
- Completed results include sentence analysis, grammar points, exactly three examples per grammar point, and deduplicated vocabulary.

## Local runtime validation

```powershell
npm run start:dev
```

Then validate the main contract flows against `/api/v1`:

1. Request `GET /health` and expect `{ "status": "ok" }`.
2. Call `POST /auth/sync` with a provider identity and expect one learner profile.
3. Call `GET /auth/me` with a valid bearer token and expect the current learner.
4. Call `GET /groups` and expect the default group first.
5. Create a group with `POST /groups`.
6. Submit text or one supported file with `POST /content` and expect `202`.
7. Subscribe to `GET /content/{id}/status` and observe lifecycle updates.
8. Retrieve `GET /content/{id}` and verify the shape matches the current lifecycle state.
9. Move content with `PATCH /content/{id}`.
10. Delete content with `DELETE /content/{id}`.

## Contract source

Use [contracts/external-api.md](./contracts/external-api.md) as the planning index. The binding contract remains `./.agents/specs/openapi.json`.
