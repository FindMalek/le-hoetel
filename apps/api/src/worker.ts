import { createDb } from "@ritorno/db"
import { loadApiEnv } from "@ritorno/env/api"
import { createNotifier } from "@ritorno/notification"
import { shutdownOnSignal, startJobs } from "./jobs"
import { startLogger } from "./logger"
import { initSentry } from "./sentry"

/** The worker on its own: `bun apps/api/src/worker.ts`, or the `worker` target of the api Dockerfile. No http server. */
const env = loadApiEnv()
startLogger(env)
initSentry(env)
const db = createDb(env.DATABASE_URL)
const jobs = await startJobs(env, db, {
  worker: true,
  notification: createNotifier(env, { appUrl: env.DASHBOARD_URL }),
})
shutdownOnSignal(jobs)
console.info(`worker running (${env.DEPLOY_ENV})`)
