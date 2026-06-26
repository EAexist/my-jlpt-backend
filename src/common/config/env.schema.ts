import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  // 향후 필요한 환경 변수를 여기에 추가하십시오.
});

export type Env = z.infer<typeof envSchema>;
