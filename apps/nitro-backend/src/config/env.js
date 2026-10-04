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
  // --- product / compliance ---
  REAL_MONEY_ENABLED: z.enum(['true', 'false']).default('false'), // false = play-money mode
  BLOCKED_COUNTRIES: z.string().default(''),                     // e.g. "US,GB" (ISO codes)
  ADMIN_API_KEY: z.string().min(24, 'ADMIN_API_KEY must be at least 24 characters').optional(),
  MIN_AGE: z.coerce.number().int().min(18).max(25).default(18),
  MIN_STAKE_MINOR: z.coerce.number().int().positive().default(100),     // 1.00
  MAX_STAKE_MINOR: z.coerce.number().int().positive().default(50000),   // 500.00
  SIGNUP_CREDIT_MINOR: z.coerce.number().int().min(0).default(100000),  // 1000.00 play money, play mode only
  JWT_EXPIRES_IN: z.string().default('7d'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[CRITICAL] Environment validation failed:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
