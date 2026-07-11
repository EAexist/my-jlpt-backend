import * as z from 'zod';

export const CreateGroupRequestSchema = z.object({
  name: z.string().min(1, 'Group name cannot be empty'),
});

export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const GroupResponseSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  name: z.string(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  contentCount: z.number().int().nonnegative(),
});

export type GroupResponse = z.infer<typeof GroupResponseSchema>;
