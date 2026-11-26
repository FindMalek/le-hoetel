import { z } from "zod"
import { parseEnv } from "./parse"

const schema = z.object({
  /** Where the Next server reaches the api: http://localhost:3001 locally, the api service inside the cluster. */
  API_URL: z.url().default("http://localhost:3001"),
  WEB_URL: z.url().default("http://localhost:3000"),
  API_PUBLIC_URL: z.url().default("http://localhost:3001"),
  DASHBOARD_URL: z.url().default("http://localhost:3002"),
  DOCS_URL: z.url().default("http://localhost:3003"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** The landing page WhatsApp button, digits only with the country code (21612345678). No number, no button. */
  WHATSAPP_CONTACT_NUMBER: z
    .string()
    .regex(/^\d{8,15}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  NEXT_PUBLIC_UMAMI_URL: z.url().default("https://cloud.umami.is"),
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
  NEXT_PUBLIC_GLITCHTIP_DSN: z.string().optional(),
})

export const nextEnv = () => parseEnv(schema)
