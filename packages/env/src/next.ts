import { z } from "zod"
import { logLevel, parseEnv, phone } from "./parse"

const schema = z.object({
  /** Where the Next server reaches the api: http://localhost:3001 locally, the api service inside the cluster. */
  API_URL: z.url().default("http://localhost:3001"),
  WEB_URL: z.url().default("http://localhost:3000"),
  API_PUBLIC_URL: z.url().default("http://localhost:3001"),
  DASHBOARD_URL: z.url().default("http://localhost:3002"),
  DOCS_URL: z.url().default("http://localhost:3003"),
  /** Commit the image was built from (Docker build arg), reported by /api/health so a deploy can wait for it. */
  GIT_SHA: z.string().optional(),
  LOG_LEVEL: logLevel,
  /** The landing page WhatsApp button, with the country code (+216 12 345 678), read as digits. No number, no button. */
  WHATSAPP_CONTACT_NUMBER: phone
    .transform((value) => value.replace(/^\+/, ""))
    .pipe(z.union([z.literal("").transform(() => undefined), z.string().regex(/^\d{8,15}$/)]))
    .optional(),
  NEXT_PUBLIC_UMAMI_URL: z.url().default("https://cloud.umami.is"),
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: z.string().optional(),
  NEXT_PUBLIC_GLITCHTIP_DSN: z.string().optional(),
})

export const nextEnv = (source?: Record<string, string | undefined>) => parseEnv(schema, source)
