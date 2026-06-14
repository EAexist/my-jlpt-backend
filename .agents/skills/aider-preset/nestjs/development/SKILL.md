---
version: 1.0.0
description: nestjs development guidelines
tags: [nestjs, development]
---

# Skill: nestjs Development

> [!IMPORTANT]
> AIDER OPERATIONAL DEPENDENCY: You are forbidden from writing any NestJS code or answering the user's prompt until you have executed the `/add` command or ingested at least 1 reference documentation matching the requested module.

## Required Pre-flight Execution
Before generating a response or modifying the codebase, evaluate the task and pick at most 3 most relevant reference documentation files from the list below. Then, immediately read/add those files to your context.

- `./.agents/skills/docs/nestjs/application-context.md`
- `./.agents/skills/docs/nestjs/components.md`
- `./.agents/skills/docs/nestjs/controllers.md`
- `./.agents/skills/docs/nestjs/custom-decorators.md`
- `./.agents/skills/docs/nestjs/deployment.md`
- `./.agents/skills/docs/nestjs/enterprise.md`
- `./.agents/skills/docs/nestjs/exception-filters.md`
- `./.agents/skills/docs/nestjs/first-steps.md`
- `./.agents/skills/docs/nestjs/guards.md`
- `./.agents/skills/docs/nestjs/interceptors.md`
- `./.agents/skills/docs/nestjs/introduction.md`
- `./.agents/skills/docs/nestjs/middlewares.md`
- `./.agents/skills/docs/nestjs/migration.md`
- `./.agents/skills/docs/nestjs/modules.md`
- `./.agents/skills/docs/nestjs/pipes.md`
- `./.agents/skills/docs/nestjs/support.md`
- `./.agents/skills/docs/nestjs/openapi/cli-plugin.md`
- `./.agents/skills/docs/nestjs/openapi/decorators.md`
- `./.agents/skills/docs/nestjs/openapi/introduction.md`
- `./.agents/skills/docs/nestjs/openapi/mapped-types.md`
- `./.agents/skills/docs/nestjs/openapi/operations.md`
- `./.agents/skills/docs/nestjs/openapi/other-features.md`
- `./.agents/skills/docs/nestjs/openapi/security.md`
- `./.agents/skills/docs/nestjs/openapi/types-and-parameters.md`
- `./.agents/skills/docs/nestjs/recipes/async-local-storage.md`
- `./.agents/skills/docs/nestjs/recipes/cqrs.md`
- `./.agents/skills/docs/nestjs/recipes/crud-generator.md`
- `./.agents/skills/docs/nestjs/recipes/documentation.md`
- `./.agents/skills/docs/nestjs/recipes/hot-reload.md`
- `./.agents/skills/docs/nestjs/recipes/mikroorm.md`
- `./.agents/skills/docs/nestjs/recipes/mongodb.md`
- `./.agents/skills/docs/nestjs/recipes/necord.md`
- `./.agents/skills/docs/nestjs/recipes/nest-commander.md`
- `./.agents/skills/docs/nestjs/recipes/passport.md`
- `./.agents/skills/docs/nestjs/recipes/prisma.md`
- `./.agents/skills/docs/nestjs/recipes/repl.md`
- `./.agents/skills/docs/nestjs/recipes/router-module.md`
- `./.agents/skills/docs/nestjs/recipes/sentry.md`
- `./.agents/skills/docs/nestjs/recipes/serve-static.md`
- `./.agents/skills/docs/nestjs/recipes/sql-sequelize.md`
- `./.agents/skills/docs/nestjs/recipes/sql-typeorm.md`
- `./.agents/skills/docs/nestjs/recipes/suites.md`
- `./.agents/skills/docs/nestjs/recipes/swc.md`
- `./.agents/skills/docs/nestjs/recipes/terminus.md`
- `./.agents/skills/docs/nestjs/techniques/caching.md`
- `./.agents/skills/docs/nestjs/techniques/compression.md`
- `./.agents/skills/docs/nestjs/techniques/configuration.md`
- `./.agents/skills/docs/nestjs/techniques/cookies.md`
- `./.agents/skills/docs/nestjs/techniques/events.md`
- `./.agents/skills/docs/nestjs/techniques/file-upload.md`
- `./.agents/skills/docs/nestjs/techniques/http-module.md`
- `./.agents/skills/docs/nestjs/techniques/logger.md`
- `./.agents/skills/docs/nestjs/techniques/mongo.md`
- `./.agents/skills/docs/nestjs/techniques/mvc.md`
- `./.agents/skills/docs/nestjs/techniques/performance.md`
- `./.agents/skills/docs/nestjs/techniques/queues.md`
- `./.agents/skills/docs/nestjs/techniques/serialization.md`
- `./.agents/skills/docs/nestjs/techniques/server-sent-events.md`
- `./.agents/skills/docs/nestjs/techniques/sessions.md`
- `./.agents/skills/docs/nestjs/techniques/sql.md`
- `./.agents/skills/docs/nestjs/techniques/streaming-files.md`
- `./.agents/skills/docs/nestjs/techniques/task-scheduling.md`
- `./.agents/skills/docs/nestjs/techniques/validation.md`
- `./.agents/skills/docs/nestjs/techniques/versioning.md`
- `./.agents/skills/docs/nestjs/security/authentication.md`
- `./.agents/skills/docs/nestjs/security/authorization.md`
- `./.agents/skills/docs/nestjs/security/cors.md`
- `./.agents/skills/docs/nestjs/security/csrf.md`
- `./.agents/skills/docs/nestjs/security/encryption-hashing.md`
- `./.agents/skills/docs/nestjs/security/helmet.md`
- `./.agents/skills/docs/nestjs/security/rate-limiting.md`
- `./.agents/skills/docs/nestjs/fundamentals/async-components.md`
- `./.agents/skills/docs/nestjs/fundamentals/circular-dependency.md`
- `./.agents/skills/docs/nestjs/fundamentals/dependency-injection.md`
- `./.agents/skills/docs/nestjs/fundamentals/discovery-service.md`
- `./.agents/skills/docs/nestjs/fundamentals/dynamic-modules.md`
- `./.agents/skills/docs/nestjs/fundamentals/execution-context.md`
- `./.agents/skills/docs/nestjs/fundamentals/lazy-loading-modules.md`
- `./.agents/skills/docs/nestjs/fundamentals/lifecycle-events.md`
- `./.agents/skills/docs/nestjs/fundamentals/module-reference.md`
- `./.agents/skills/docs/nestjs/fundamentals/platform-agnosticism.md`
- `./.agents/skills/docs/nestjs/fundamentals/provider-scopes.md`
- `./.agents/skills/docs/nestjs/fundamentals/unit-testing.md`


## Enforcement Protocol
1. **Identify** which category above matches the user instruction.
2. **Execute Ingestion:** Use your internal file-reading capability to fully parse the matching target path (e.g., `./.agents/skills/docs/nestjs/<category>.md`) *before* generating your code proposal.
3. **Match Style:** Adhere strictly to the patterns and rules specified in the read document.