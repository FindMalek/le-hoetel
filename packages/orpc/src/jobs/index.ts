import type { Job } from "@ritorno/jobs"
import { SEND_PACING, type SendPacing } from "../lib/automations"
import { birthdayJob } from "./birthday"
import { campaignJob } from "./campaigns"
import { holidayJob } from "./holidays"
import { surveyJob } from "./survey"
import { type JobServices, welcomeJob } from "./welcome"

export { enqueueWelcome, type JobServices } from "./welcome"

/** The jobs that send to guests. They need the dispatcher's services, so the api builds them and hands them to the runner next to `JOBS`. */
export const createMessageJobs = (services: JobServices, options: Partial<SendPacing> = {}): readonly Job[] => {
  const pacing = { ...SEND_PACING, ...options }
  return [
    welcomeJob(services, pacing),
    birthdayJob(services, pacing),
    holidayJob(services, pacing),
    surveyJob(services, pacing),
    campaignJob(services, { pauseMs: pacing.pauseMs, batchSize: pacing.batchSize }),
  ]
}
