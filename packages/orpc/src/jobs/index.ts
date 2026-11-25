import type { Job } from "@le-hoetel/jobs"
import { birthdayJob } from "./birthday"
import { type JobServices, welcomeJob } from "./welcome"

export { enqueueWelcome, type JobServices } from "./welcome"

/** The jobs that send to guests. They need the dispatcher's services, so the api builds them and hands them to the runner next to `JOBS`. */
export const createMessageJobs = (services: JobServices): readonly Job[] => [
  welcomeJob(services),
  birthdayJob(services),
]
