import { z } from 'zod';

export const AuthSyncRequestSchema = z.object({
  idToken: z.string().min(1),
});

export type AuthSyncRequest = z.infer<typeof AuthSyncRequestSchema>;

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;
