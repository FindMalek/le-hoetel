import type { Db } from "@ritorno/db"
import type { ApiEnv } from "@ritorno/env/api"
import { connectBoss, createJobs, JOBS, type JobsRunner } from "@ritorno/jobs"
import type { Notifier } from "@ritorno/notification"
import { createMessageJobs } from "@ritorno/orpc/jobs"
import { serviceConfig } from "./config"
import { captureJobFailure } from "./sentry"

/** Connects pg-boss to the app database, or trigger.dev when `TRIGGER_SECRET_KEY` is set. With `worker` off this process only enqueues. */
export async function startJobs(
  env: ApiEnv,
  db: Db,
  options: { worker: boolean; notification: Notifier },
): Promise<JobsRunner> {
  const boss = connectBoss(env.DATABASE_URL, {
    worker: options.worker,
    onError: (error) => console.error("[jobs]", error),
  })
  const messageJobs = createMessageJobs({
    db,
    config: serviceConfig(env),
    now: () => new Date(),
    notification: options.notification,
  })
  const jobs = createJobs({
    boss,
    db,
    worker: options.worker,
    jobs: [...JOBS, ...messageJobs],
    onFailure: ({ name, id, error }) => captureJobFailure(name, id, error),
  })
  await jobs.start()
  return jobs
}

/** On SIGTERM or SIGINT: stop taking requests, let running jobs finish (up to 8s), then exit. */
export function shutdownOnSignal(jobs: JobsRunner, server?: { stop(): unknown }) {
  let stopping = false
  const stop = async (signal: string) => {
    if (stopping) return
    stopping = true
    console.info(`${signal} received, finishing running jobs`)
    await server?.stop()
    await jobs.stop()
    process.exit(0)
  }
  process.on("SIGTERM", () => void stop("SIGTERM"))
  process.on("SIGINT", () => void stop("SIGINT"))
}
