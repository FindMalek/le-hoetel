import { resolveModel } from "@le-hoetel/ai"
import { createAuth } from "@le-hoetel/auth"
import { createDb } from "@le-hoetel/db"
import { runMigrations } from "@le-hoetel/db/migrate"
import { seedDemo } from "@le-hoetel/db/seed"
import { loadApiEnv } from "@le-hoetel/env/api"
import { authEmails, createNotifier } from "@le-hoetel/notification"
import { createRateLimiter } from "@le-hoetel/orpc"
import { createStorage } from "@le-hoetel/storage"
import * as Sentry from "@sentry/bun"
import { ensureAdmin } from "./admin"
import { serviceConfig } from "./config"
import { shutdownOnSignal, startJobs } from "./jobs"
import { startLogger } from "./logger"
import { startOpenObserve } from "./openobserve"
import { PREVIEW_ORIGINS } from "./origins"
import { createServer } from "./server"

const env = loadApiEnv()
startLogger(env)
Sentry.init({ dsn: env.GLITCHTIP_DSN, environment: env.DEPLOY_ENV })
startOpenObserve(env)
const db = createDb(env.DATABASE_URL)
await runMigrations(db)
const notification = createNotifier(env, { appUrl: env.DASHBOARD_URL })
const jobs = await startJobs(env, db, { worker: env.JOBS_WORKER, notification })

const trustedOrigins = [
  env.WEB_URL,
  env.DASHBOARD_URL,
  ...(env.ALLOW_PREVIEW_ORIGINS === "true" ? PREVIEW_ORIGINS : []),
]

const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  dashboardUrl: env.DASHBOARD_URL,
  trustedOrigins,
  github:
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
      : undefined,
  secureCookies: env.NODE_ENV === "production",
  ...authEmails(notification),
})

const adminId = await ensureAdmin(db, auth, env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
if (env.SEED === "demo") {
  const hashPassword = (await auth.$context).password.hash
  if (await seedDemo(db, { ownerId: adminId, hashPassword, demoPassword: env.DEMO_PASSWORD }))
    console.info("seeded demo data")
}

const fetch = createServer(
  {
    db,
    auth,
    now: () => new Date(),
    config: serviceConfig(env),
    jobs,
    rateLimiter: createRateLimiter({
      upstashUrl: env.UPSTASH_REDIS_REST_URL,
      upstashToken: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    storage: createStorage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      prefix: env.S3_PREFIX ?? (env.DEPLOY_ENV.startsWith("pr-") ? `${env.DEPLOY_ENV}/` : ""),
    }),
    notification,
    model: resolveModel(env.AI_MODEL, env),
  },
  { publicUrl: env.API_PUBLIC_URL },
)

const server = Bun.serve({ port: env.PORT, hostname: "0.0.0.0", fetch })
shutdownOnSignal(jobs, server)
console.info(`api on :${server.port} (${env.DEPLOY_ENV})`)
