import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1), // allow "file:dev.db"
  NEXT_PUBLIC_API_BASE_URL: z.string().url().optional(),
  ALERT_THRESHOLD: z.coerce.number().min(0).max(100).default(65),
  OPENAI_API_KEY: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  MAPBOX_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().min(8),
  SLACK_MIN_LEVEL: z.enum(["LOW","MEDIUM","HIGH"]).default("HIGH"),
  ACTION_SECRET: z.string().min(16),
  ACTION_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),
  USE_REDIS: z.enum(["true", "false"]).default("false"),
  REDIS_URL: z.string().url().optional(),
  INGEST_HMAC_SECRET: z.string().min(16).optional(),
  INCIDENT_SLA_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(60),
  RETENTION_DAYS_DISMISSED: z.coerce.number().int().min(7).max(365).default(30),
  RETENTION_DAYS_VERIFIED: z.coerce.number().int().min(30).max(730).default(180),
}).refine(v => v.USE_REDIS === "false" || !!v.REDIS_URL, {
  path: ["REDIS_URL"],
  message: "REDIS_URL required when USE_REDIS=true",
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  ALERT_THRESHOLD: process.env.ALERT_THRESHOLD,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
  MAPBOX_TOKEN: process.env.MAPBOX_TOKEN,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  SLACK_MIN_LEVEL: process.env.SLACK_MIN_LEVEL,
  USE_REDIS: process.env.USE_REDIS,
  REDIS_URL: process.env.REDIS_URL,
  INGEST_HMAC_SECRET: process.env.INGEST_HMAC_SECRET,
  INCIDENT_SLA_MINUTES: process.env.INCIDENT_SLA_MINUTES,
  RETENTION_DAYS_DISMISSED: process.env.RETENTION_DAYS_DISMISSED,
  RETENTION_DAYS_VERIFIED: process.env.RETENTION_DAYS_VERIFIED,
});


