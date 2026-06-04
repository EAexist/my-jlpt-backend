# CLAUDE.md

> Global context for all AI agents. For specific feature implementations, read the referenced AGENT_*.md files.

---

## Technical Stack & Deployment Boundary
- **Framework:** NestJS (Node.js) on Google Cloud Run (Serverless, Request-based lifecycle).
- **Database:** Prisma ORM connecting to NeonDB (PostgreSQL).
- **Authentication:** Frontend owns OAuth via Auth.js (NextAuth). Backend exposes a sync endpoint to create/manage custom user entities based on Auth.js payloads.
- **Microservices:** FastAPI NLP microservice, communicated with via Direct VPC Egress over the default internal network (`--network=default`).
- **Asynchronous Tasks:** Cloud Run instances freeze CPU on request termination. Background operations must use **Google Cloud Tasks** HTTP targets to trigger asynchronous processing endpoints reliably without Redis overhead.

---

## Directory Structure

backend/
├── src/
│   ├── modules/
│   │   ├── auth/         # Auth sync and session management
│   │   ├── content/      # Text processing & persistence
│   │   ├── llm/          # Gemini API wrapper
│   │   ├── nlp/          # FastAPI HTTP client
│   │   └── job/          # Cloud Tasks handlers & state tracking
│   ├── common/
│   │   ├── config/       # Environment configuration
│   │   ├── decorators/   # Context extraction (e.g., @CurrentUser())
│   │   └── guards/       # Custom Auth.js session validation guards
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   └── schema.prisma
├── package.json
└── .env


---

## Strict Implementation Rules

1. **Controller Layer:** Keep controllers thin. They handle route definition, payload validation via `ValidationPipe`, and delegate orchestration immediately to Services.
2. **Gemini API SDK:** Use `@google/genai` (NOT the deprecated `@google/generative-ai`). Use `gemini-2.5-flash` with structured outputs (`responseMimeType: 'application/json'`).
3. **Database Constraints:** All database access must pass through Prisma. Never write raw SQL unless explicitly instructed. Always clean up connections in lifecycle hooks.
4. **Error Handling:** Catch structural errors at the service layer and throw standard NestJS `HttpException` variants (`NotFoundException`, `BadRequestException`) so the global filter maps them to correct HTTP status codes.

---

## Environment Variables

```bash
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://...
JWT_SECRET=changeme
GEMINI_API_KEY=AIzaSy...
NLP_SERVICE_URL=[http://nlp-service.internal](http://nlp-service.internal)
LLM_BATCH_SIZE=5
CLOUD_TASKS_QUEUE_NAME=pipeline-queue
```
