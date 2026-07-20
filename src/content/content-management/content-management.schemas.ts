import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const MoveContentSchema = z.object({
  groupId: z.string().uuid(),
});

export class MoveContentDto extends createZodDto(MoveContentSchema) {}

export type Pagination = z.infer<typeof PaginationSchema>;
export type MoveContent = z.infer<typeof MoveContentSchema>;
