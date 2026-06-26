import { z } from 'zod';

export const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.string().default('development'),
});

export type Config = z.infer<typeof configSchema>;

export const validateConfig = (config: Record<string, unknown>) => {
  return configSchema.parse(config);
};
