import { createDb } from "@le-hoetel/db"
import { loadApiEnv } from "@le-hoetel/env/api"
import { shutdownOnSignal, startJobs } from "./jobs"
import { startLogger } from "./logger"

/** The worker on its own: `bun apps/api/src/worker.ts`, or the `worker` target of the api Dockerfile. No http server. */
const env = loadApiEnv()
startLogger(env)
const db = createDb(env.DATABASE_URL)
const jobs = await startJobs(env, db, { worker: true })
shutdownOnSignal(jobs)
console.info(`worker running (${env.DEPLOY_ENV})`)
