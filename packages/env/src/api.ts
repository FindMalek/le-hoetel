import { z } from "zod"
import { parseEnv } from "./parse"

const optional = z.string().optional()

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  /** "production", "pr-<n>" for previews, or "local". */
  DEPLOY_ENV: z.string().default("local"),
  DATABASE_URL: z.string().min(1),
  SEED: z.enum(["none", "demo"]).default("demo"),
  /** Password of every seeded demo account (fake, on @demo.ritorno.test). Defaults to the one in the docs. */
  DEMO_PASSWORD: optional,

  /** Public origins: the api's own, and the two apps that proxy to it. */
  API_PUBLIC_URL: z.url().default("http://localhost:3001"),
  WEB_URL: z.url().default("http://localhost:3000"),
  DASHBOARD_URL: z.url().default("http://localhost:3002"),

  BETTER_AUTH_SECRET: z.string().min(32),
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  /** First admin, created (or its password reset) on every start. */
  ADMIN_EMAIL: optional,
  ADMIN_PASSWORD: optional,
  /** Who hears about a new demo request. Defaults to `ADMIN_EMAIL`. */
  LEADS_NOTIFY_EMAIL: optional,

  /** Public repo shown on the landing page (owner/name). */
  GITHUB_REPO: optional,
  GITHUB_TOKEN: optional,

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** Shared by the cache and the rate limits; without them both are kept in memory per process. */
  UPSTASH_REDIS_REST_URL: z.url().optional(),
  UPSTASH_REDIS_REST_TOKEN: optional,

  /** Run the job worker inside the api. Turn off when it runs in its own container (apps/api/Dockerfile, target worker). */
  JOBS_WORKER: z.stringbool().default(true),

  S3_ENDPOINT: optional,
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: optional,
  /** Key prefix inside the bucket, e.g. "staging/". Empty for production, "pr-<n>/" is used for previews. */
  S3_PREFIX: optional,
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,

  OPENOBSERVE_URL: z.url().optional(),
  OPENOBSERVE_ORG: z.string().default("default"),
  OPENOBSERVE_USER: optional,
  OPENOBSERVE_PASSWORD: optional,

  GLITCHTIP_DSN: optional,

  MESSAGING_LIVE: z.enum(["true", "false"]).default("false"),
  /** Staging only: also trust the browser origins of PR previews and *.findmalek.engineer (see docs: previews). */
  ALLOW_PREVIEW_ORIGINS: z.enum(["true", "false"]).default("false"),
  RESEND_API_KEY: optional,
  RESEND_WEBHOOK_SECRET: optional,
  EMAIL_FROM: z.string().default("Ritorno <onboarding@resend.dev>"),
  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_CHAT_ID: optional,
  TELEGRAM_WEBHOOK_SECRET: optional,
  TELEGRAM_BOT_USERNAME: optional,
  KAPSO_API_KEY: optional,
  KAPSO_WEBHOOK_SECRET: optional,
  WHATSAPP_PHONE_NUMBER_ID: optional,
  WHATSAPP_NOTIFY_TO: optional,
  WHATSAPP_TEMPLATE_NAME: z.string().default("app_notification"),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en_US"),

  AI_MODEL: z.string().default("groq:openai/gpt-oss-120b"),
  GROQ_API_KEY: optional,
  OPENAI_API_KEY: optional,
  ANTHROPIC_API_KEY: optional,
})

export type ApiEnv = z.infer<typeof schema>
export const loadApiEnv = (source?: Record<string, string | undefined>) => parseEnv(schema, source)
