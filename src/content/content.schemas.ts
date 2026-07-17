import { z } from 'zod';

// Reusable schemas based on OpenAPI definitions
export const JLPTLevelSchema = z.enum(['N1', 'N2', 'N3', 'N4', 'N5']);

export const FuriganaTokenSchema = z.object({
  text: z.string(),
  reading: z.string(),
});

export const GrammarExampleSchema = z.object({
  japanese: z.string(),
  translation: z.string(),
  tokens: z.array(FuriganaTokenSchema).optional(),
});

export const GrammarPointSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  level: JLPTLevelSchema,
  description: z.string(),
  explanation: z.string(),
  examples: z.array(GrammarExampleSchema),
});

export const VocabularyItemSchema = z.object({
  id: z.string().uuid(),
  word: z.string(),
  reading: z.string(),
  level: JLPTLevelSchema,
  translation: z.string(),
  synonyms: z.array(z.string()),
  examplePhrases: z.array(z.string()),
  tokens: z.array(FuriganaTokenSchema).optional(),
});

export const SentenceSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  translation: z.string(),
  level: JLPTLevelSchema,
  grammarPoints: z.array(GrammarPointSchema),
  tokens: z.array(FuriganaTokenSchema).optional(),
});

export const SectionSchema = z.object({
  id: z.string().uuid(),
  sentences: z.array(SentenceSchema),
  level: JLPTLevelSchema,
  grammarPatterns: z.array(GrammarPointSchema),
  vocabularies: z.array(VocabularyItemSchema),
});

// Content Request Schemas
export const UploadUrlRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
});

export const UploadUrlResponseSchema = z.object({
  signedUrl: z.string().url(),
  objectKey: z.string().uuid(),
  expiresAt: z.string().datetime(),
});

export const CreateContentRequestSchema = z
  .object({
    title: z.string().min(1),
    groupId: z.string().uuid(),
    text: z.string().optional(),
    inputReference: z
      .object({
        objectKey: z.string().uuid(),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
      })
      .optional(),
  })
  .refine((data) => !!data.text !== !!data.inputReference, {
    message: "Exactly one of 'text' or 'inputReference' must be provided.",
    path: ['text', 'inputReference'],
  });

// Content Response Schemas
export const BaseContentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  title: z.string(),
  groupId: z.string().uuid(),
  inputText: z.string(),
  createdAt: z.string().datetime(),
});

export const ProcessingContentSchema = BaseContentSchema.extend({
  status: z.enum(['PENDING', 'PROCESSING']),
  progress: z.number().default(0),
  currentStep: z.string().default(''),
});

export const FailedContentSchema = BaseContentSchema.extend({
  status: z.literal('FAILED'),
  errorMessage: z.string(),
});

export const CompletedContentSchema = BaseContentSchema.extend({
  status: z.literal('COMPLETED'),
  overallLevel: JLPTLevelSchema,
  vocabulary: z.array(VocabularyItemSchema),
  sections: z.array(SectionSchema).default([]),
});

export const ContentSchema = z.discriminatedUnion('status', [
  ProcessingContentSchema,
  FailedContentSchema,
  CompletedContentSchema,
]);

// Exported types
export type FuriganaToken = z.infer<typeof FuriganaTokenSchema>;
export type GrammarExample = z.infer<typeof GrammarExampleSchema>;
export type GrammarPoint = z.infer<typeof GrammarPointSchema>;
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;
export type Sentence = z.infer<typeof SentenceSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type BaseContent = z.infer<typeof BaseContentSchema>;
export type ProcessingContent = z.infer<typeof ProcessingContentSchema>;
export type FailedContent = z.infer<typeof FailedContentSchema>;
export type CompletedContent = z.infer<typeof CompletedContentSchema>;
