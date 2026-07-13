import { z } from 'zod';

// Reusable schemas based on OpenAPI definitions
export const JLPTLevelSchema = z.enum(['N1', 'N2', 'N3', 'N4', 'N5']);

export const GrammarExampleSchema = z.object({
  japanese: z.string(),
  translation: z.string(),
});

export const GrammarPointSchema = z.object({
  name: z.string(),
  level: JLPTLevelSchema,
  description: z.string(),
  examples: z.array(GrammarExampleSchema),
});

export const VocabularyItemSchema = z.object({
  word: z.string(),
  reading: z.string(),
  level: JLPTLevelSchema,
  translation: z.string(),
  synonyms: z.array(z.string()),
  example_phrases: z.array(z.string()),
});

export const SentenceSchema = z.object({
  text: z.string(),
  translation: z.string(),
  level: JLPTLevelSchema,
  grammar_points: z.array(GrammarPointSchema),
  similar_patterns: z.array(z.string()),
});

// Multipart Ingestion Schema
export const CreateContentMultipartSchema = z
  .object({
    title: z.string(),
    group: z.string().uuid(),
    text: z.string().optional(),
    // Note: z.file() usually requires specific handling in frameworks.
    // Assuming a generic file validation or reliance on framework-level piping.
    file: z.any().optional(),
  })
  .refine((data) => !!data.text !== !!data.file, {
    message: "Exactly one of 'text' or 'file' must be provided.",
    path: ['text', 'file'],
  });

// Content Response Schemas
export const BaseContentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  title: z.string(),
  groupId: z.string().uuid(),
  input_text: z.string(),
  created_at: z.string().datetime(),
});

export const ProcessingContentSchema = BaseContentSchema.extend({
  status: z.enum(['PENDING', 'PROCESSING']),
});

export const FailedContentSchema = BaseContentSchema.extend({
  status: z.literal('FAILED'),
  error_message: z.string(),
});

export const CompletedContentSchema = BaseContentSchema.extend({
  status: z.literal('COMPLETED'),
  overall_level: JLPTLevelSchema,
  sentences: z.array(SentenceSchema),
  vocabulary: z.array(VocabularyItemSchema),
});

export const ContentSchema = z.discriminatedUnion('status', [
  ProcessingContentSchema,
  FailedContentSchema,
  CompletedContentSchema,
]);
