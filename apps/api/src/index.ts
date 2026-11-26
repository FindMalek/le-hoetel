import { resolveModel } from "@ritorno/ai"
import { createAuth } from "@ritorno/auth"
import { createDb } from "@ritorno/db"
import { runMigrations } from "@ritorno/db/migrate"
import { loadApiEnv } from "@ritorno/env/api"
import { authEmails, createNotifier } from "@ritorno/notification"
import { createRateLimiter } from "@ritorno/orpc"
import { createStorage } from "@ritorno/storage"
import { ensureAdmin } from "./admin"
import { serviceConfig } from "./config"
import { shutdownOnSignal, startJobs } from "./jobs"
import { startLogger } from "./logger"
import { startOpenObserve } from "./openobserve"
import { PREVIEW_ORIGINS } from "./origins"
import { seedOnBoot } from "./seed"
import { initSentry } from "./sentry"
import { createServer } from "./server"

const env = loadApiEnv()
startLogger(env)
initSentry(env)
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
const storage = createStorage({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  bucket: env.S3_BUCKET,
  accessKeyId: env.S3_ACCESS_KEY_ID,
  secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  prefix: env.S3_PREFIX ?? (env.DEPLOY_ENV.startsWith("pr-") ? `${env.DEPLOY_ENV}/` : ""),
})
if (env.SEED === "demo") {
  await seedOnBoot(db, {
    ownerId: adminId,
    hashPassword: (await auth.$context).password.hash,
    demoPassword: env.DEMO_PASSWORD,
    deployEnv: env.DEPLOY_ENV,
    databaseUrl: env.DATABASE_URL,
    storage,
    webUrl: env.WEB_URL,
    apiUrl: env.API_PUBLIC_URL,
  })
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
    storage,
    notification,
    model: resolveModel(env.AI_MODEL, env),
  },
  { publicUrl: env.API_PUBLIC_URL },
)

const server = Bun.serve({ port: env.PORT, hostname: "0.0.0.0", fetch })
shutdownOnSignal(jobs, server)
console.info(`api on :${server.port} (${env.DEPLOY_ENV})`)
