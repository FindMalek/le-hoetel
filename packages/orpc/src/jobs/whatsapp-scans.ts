import { defineJob } from "@ritorno/jobs"
import { z } from "zod"
import { purgeOldScans } from "../lib/whatsapp-scans"
import type { JobServices } from "./welcome"

export const SCAN_PURGE_JOB = "purge-whatsapp-scans"

export const scanPurgeJob = (services: JobServices) =>
  defineJob({
    name: SCAN_PURGE_JOB,
    description: "Delete WhatsApp scans older than 30 days",
    payload: z.object({}),
    cron: "17 * * * *",
    scheduleData: {},
    handler: async (_payload, { now }) => {
      await purgeOldScans(services.db, now())
    },
  })
