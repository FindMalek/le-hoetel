import type { Job } from "@le-hoetel/jobs"
import { birthdayJob } from "./birthday"
import { campaignJob } from "./campaigns"
import { holidayJob } from "./holidays"
import { type JobServices, welcomeJob } from "./welcome"

export { enqueueWelcome, type JobServices } from "./welcome"

/** The jobs that send to guests. They need the dispatcher's services, so the api builds them and hands them to the runner next to `JOBS`. */
export const createMessageJobs = (
  services: JobServices,
  options: { campaignPauseMs?: number; campaignBatchSize?: number } = {},
): readonly Job[] => [
  welcomeJob(services),
  birthdayJob(services),
  holidayJob(services),
  campaignJob(services, { pauseMs: options.campaignPauseMs, batchSize: options.campaignBatchSize }),
]
