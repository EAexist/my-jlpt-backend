# background-pipeline-spec.md

## Objective
Orchestrate the content text analysis pipeline utilizing Google Cloud Tasks to execute asynchronously within Cloud Run's request-based execution rules.

## Core Architecture
1. **Triggering Endpoint:** Frontend requests job via `POST /content`. Backend creates a database `Job` tracking record in a `pending` state and dispatches an HTTP task to Google Cloud Tasks.
2. **Worker Target:** Cloud Tasks invokes an internal backend route `POST /job/execute` asynchronously. This provides dedicated CPU allocation for processing.

## Pipeline Phasing & State Tracking
The pipeline must meticulously track progress states inside the `Job` record to update user-facing interfaces accurately:

- **Phase 1 (16%):** Initialize payload validation.
- **Phase 2 (33%):** Call `NlpService` to parse structure, extract core sentences, and tokenize.
- **Phase 3 (66%):** Execute structured, batched `GeminiService` analysis loops matching `LLM_BATCH_SIZE`.
- **Phase 4 (83%):** Compute complex level scores, aggregate errors, and assemble the structured content object.
- **Phase 5 (100%):** Write final processed data payload into `prisma.content`, flag status as `completed`.

## Error Handling & Resiliency
- Enclose the runner loop execution entirely within a `try/catch` block. On failure, update the status field to `failed` and populate the error message string.
- **Stuck-Job Maintenance:** Expose a cron service running hourly via `@nestjs/schedule` to clean up orphaned processing rows that have exceeded a reasonable runtime window (10 minutes).

```typescript
@Cron('0 * * * *')
async cleanStuckJobs() {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  await this.prisma.job.updateMany({
    where: { status: 'processing', updatedAt: { lt: tenMinutesAgo } },
    data: { status: 'failed', error: 'Job execution timed out' },
  });
}
```