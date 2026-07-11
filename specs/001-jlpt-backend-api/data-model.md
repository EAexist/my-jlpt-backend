# Data Model: JLPT Backend API

> **Update note**: As of this revision, the external NLP worker's responsibilities are limited to (1) chunking input text into ordered 2-3 sentence groups and (2) extracting and dictionary-matching vocabulary. Grammar pattern identification and all grammar-related generation now belong to this service's `llm` module (Gemini), not the NLP worker. Entities below are annotated where this affects field provenance; unresolved provenance questions are marked as open questions (see chat) rather than guessed.

## Learner

Represents an authenticated user synchronized from the client sign-in flow.

**Fields**

- `id`: UUID, primary identifier
- `provider`: non-empty identity provider name
- `providerAccountId`: non-empty provider account identifier
- `email`: nullable email
- `name`: nullable display name
- `avatarUrl`: nullable URI
- `createdAt`: creation timestamp
- `updatedAt`: last profile synchronization timestamp

**Relationships**

- Owns many `Group` records
- Owns many `Content` records through groups

**Validation and rules**

- `(provider, providerAccountId)` is unique.
- Synchronization is idempotent and updates profile fields for an existing identity.
- A default group must exist for every learner.

## Group

Learner-owned container for organizing content.

**Fields**

- `id`: UUID
- `ownerId`: learner UUID
- `name`: non-empty learner-visible name
- `isDefault`: boolean
- `createdAt`: timestamp
- `updatedAt`: timestamp

**Relationships**

- Belongs to one `Learner`
- Contains many `Content` records

**Validation and rules**

- Groups are private to the owning learner.
- The default group is returned first in listings.
- Default groups cannot be deleted or renamed.
- Deleting a non-default group reassigns its content to the learner's default group.
- `contentCount` is returned as derived data.

## Content

Learner-owned study material request and result.

**Fields**

- `id`: UUID
- `ownerId`: learner UUID
- `groupId`: group UUID
- `title`: non-empty string
- `inputText`: text source or extracted text reference required by the contract
- `inputFileObjectKey`: nullable object storage key for uploaded files
- `inputFileName`: nullable original file name
- `inputMimeType`: nullable MIME type
- `status`: `PENDING`, `PROCESSING`, `COMPLETED`, or `FAILED`
- `overallLevel`: nullable JLPT level for completed content
- `errorMessage`: nullable user-readable failure message
- `createdAt`: timestamp
- `updatedAt`: timestamp

**Relationships**

- Belongs to one `Learner`
- Belongs to one `Group`
- Has one `ProcessingJob`
- Has many `SentenceAnalysis` records
- Has many deduplicated `VocabularyItem` records

**Validation and rules**

- `groupId` must belong to the authenticated learner.
- Creation accepts exactly one source: text or supported file.
- Supported files are PDF and plain text, smaller than 10 MB.
- Content can move only to another group owned by the same learner.
- Cross-learner access returns the contract-specified unauthorized, forbidden, or not-found result.

## ProcessingJob

Durable async processing state associated with a content item.

**Fields**

- `id`: UUID
- `contentId`: content UUID
- `status`: `PENDING`, `PROCESSING`, `COMPLETED`, or `FAILED`
- `progress`: integer 0-100 where available
- `currentStep`: nullable learner-readable processing step
- `externalTaskName`: nullable Cloud Tasks task identifier
- `attemptCount`: non-negative integer
- `idempotencyKey`: unique key for retry-safe processing
- `startedAt`: nullable timestamp
- `completedAt`: nullable timestamp
- `failedAt`: nullable timestamp
- `errorMessage`: nullable user-readable failure message

**Relationships**

- Belongs to one `Content`

**State transitions**

```text
PENDING -> PROCESSING -> COMPLETED
PENDING -> PROCESSING -> FAILED
PENDING -> FAILED
FAILED -> PROCESSING -> COMPLETED   # retry path when explicitly retried by infrastructure
```

**Validation and rules**

- Terminal states must not produce conflicting learner-visible results.
- Retries must be idempotent for the same accepted content job.
- Status updates drive the SSE stream and content lifecycle responses.

## SentenceAnalysis

Analysis for one sentence in completed content.

**Fields**

- `id`: UUID
- `contentId`: content UUID
- `position`: integer preserving sentence order
- `text`: Japanese sentence text
- `translation`: translated sentence text
- `level`: JLPT level
- `similarPatterns`: string list

**Relationships**

- Belongs to one `Content`
- Has many `GrammarPoint` records

**Validation and rules**

- Sentence order is stable.
- Completed content returns all sentence analyses for that content.
- **Resolved**: one `SentenceAnalysis` row corresponds to one NLP-worker chunk of 2-3 *original* sentences (the worker first segments the input into individual sentences, then groups consecutive sentences into chunks — see the FastAPI NLP service spec for the exact grouping algorithm). Grouping exists only to avoid a chunk of a single very short sentence; `text` is the chunk's full original text, not a single grammatical sentence.
- **Resolved**: `translation` is entirely NestJS's responsibility (`llm` module via Gemini). The NLP worker does not produce translations.
- `similarPatterns` and grammar-adjacent classification are populated by the `llm` module, not the NLP worker.

## GrammarPoint

Grammar pattern identified in a sentence.

**Fields**

- `id`: UUID
- `sentenceAnalysisId`: sentence analysis UUID
- `name`: pattern name
- `level`: JLPT level
- `description`: learner-facing explanation

**Relationships**

- Belongs to one `SentenceAnalysis`
- Has exactly three `GrammarExample` records in completed output
- May reference cached examples by pattern name

**Validation and rules**

- Completed output must include exactly three examples per grammar point.
- Identical grammar patterns should reuse cached examples when available.
- Grammar pattern identification (which patterns exist in a given sentence) is performed by the `llm` module via Gemini. This is a change from prior versions of this spec, in which grammar identification was an NLP-worker responsibility.

## GrammarExample

Generated Japanese example sentence and translation.

**Fields**

- `id`: UUID
- `grammarPointId`: grammar point UUID
- `japanese`: Japanese example sentence
- `translation`: translated example
- `position`: integer from 1 through 3

**Relationships**

- Belongs to one `GrammarPoint`

**Validation and rules**

- Exactly three examples are returned for each completed grammar point.

## GrammarExampleCache

Reusable cached examples for identical grammar patterns.

**Fields**

- `patternName`: unique grammar pattern key
- `level`: nullable JLPT level
- `examples`: three example sentence/translation pairs
- `createdAt`: timestamp
- `updatedAt`: timestamp

**Validation and rules**

- Cache entries must preserve consistent examples for identical grammar patterns.
- Cache misses may invoke Gemini; cache hits must avoid duplicate generation.

## VocabularyItem

Deduplicated vocabulary entry for completed content.

**Fields**

- `id`: UUID
- `contentId`: content UUID
- `word`: Japanese word
- `reading`: reading
- `level`: JLPT level
- `translation`: translated meaning
- `synonyms`: string list
- `examplePhrases`: string list

**Relationships**

- Belongs to one `Content`

**Validation and rules**

- Vocabulary is deduplicated per content result by normalized word and reading.
- Required fields match the external contract.
- **Resolved**: the NLP worker returns only dictionary-matchable fields — `word` (dictionary/lemma form), `reading`, `level` (nullable, JLPT-list lookup), and `translation` (nullable, primary JMDict gloss). Tokens with no dictionary match are omitted by the worker entirely (not returned as partial items).
- **Resolved**: `synonyms` and `examplePhrases` are NOT produced by the NLP worker (JMDict/JLPT-list matching does not reliably provide these). They are out of the NLP worker's scope; population strategy (LLM-generated, left empty, or a later enhancement) is a NestJS-side decision outside this data model's NLP-worker contract.

## UploadedFile

Intermediate metadata for files handed off to the private NLP worker.

**Fields**

- `id`: UUID
- `contentId`: content UUID
- `objectKey`: GCS object key
- `originalName`: file name
- `mimeType`: MIME type
- `sizeBytes`: integer smaller than 10 MB
- `createdAt`: timestamp

**Relationships**

- Belongs to one `Content`

**Validation and rules**

- Only PDF and plain text uploads are accepted.
- The NestJS service stores and dispatches file references; it does not perform document parsing.
- **Resolved**: PDF/text-to-plain-text extraction is performed by the FastAPI NLP worker, as a precursor step before its chunking step (it must have plain text before sentence segmentation). This keeps CPU-intensive parsing outside the NestJS service, consistent with this plan's existing constraint, and avoids adding PDF-parsing dependencies to `package.json`.