import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url("Valid PostgreSQL connection string required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters long"),
  NOWPAYMENTS_API_KEY: z.string().optional(),
  ODDS_API_KEY: z.string().optional(),
  FRONTEND_URL: z.string().default('*'), // comma-separated list of allowed origins, or *
  DATABASE_SSL: z.enum(['true', 'false']).optional(), // override the production default
  OPENF1_BASE_URL: z.string().url().default('https://api.openf1.org/v1'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[CRITICAL] Environment validation failed:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
