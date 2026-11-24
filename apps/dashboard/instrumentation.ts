import { nextEnv } from "@le-hoetel/env/next"
import * as Sentry from "@sentry/nextjs"
import type { Instrumentation } from "next"

/** Modules such as logger and glitchtip hook in here: Next runs `register` once when the server starts. */
const startups: Array<() => void | Promise<void>> = []
startups.push(async () => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { nextEnv: loadEnv } = await import("@le-hoetel/env/next")
  const { registerLogger } = await import("@le-hoetel/logger/next")
  registerLogger({ level: loadEnv().LOG_LEVEL })
})
startups.push(() => {
  Sentry.init({ dsn: nextEnv().NEXT_PUBLIC_GLITCHTIP_DSN })
})

const requestErrorHandlers: Instrumentation.onRequestError[] = []
requestErrorHandlers.push(Sentry.captureRequestError)
requestErrorHandlers.push(async (...args) => {
  if (process.env.NEXT_RUNTIME === "nodejs") (await import("@le-hoetel/logger/next")).logRequestError(...args)
})

export async function register() {
  for (const start of startups) await start()
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  await Promise.all(requestErrorHandlers.map((handler) => handler(...args)))
}
