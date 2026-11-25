import type { Auth, Session } from "@le-hoetel/auth"
import type { Db } from "@le-hoetel/db"
import type { Jobs } from "@le-hoetel/jobs"
import type { Notifier } from "@le-hoetel/notification"
import type { Storage } from "@le-hoetel/storage"
import type { LanguageModel } from "ai"
import type { RateLimiter } from "./lib/rate-limit"

/** Everything procedures need, built once by the api at startup (and by tests with their own). */
export interface Services {
  db: Db
  auth: Auth
  now: () => Date
  config: {
    deployEnv: string
    githubAuth: boolean
    githubRepo?: string
    githubToken?: string
    webUrl: string
    dashboardUrl: string
    apiUrl: string
    /** Signs unsubscribe links. Derived from the auth secret, never sent anywhere. */
    tokenSecret: string
    /** Signing secrets of provider webhooks. A route answers 404 without its secret. */
    webhookSecrets?: { resend?: string; kapso?: string }
  }
  rateLimiter: RateLimiter
  jobs: Jobs
  storage: Storage | null
  notification: Notifier
  model: LanguageModel | null
}

export type Context = Services & {
  headers: Headers
  session: Session | null
  /** Set when the call authenticated with an API key (api-keys module) instead of a browser session. */
  apiKey: { id: string; scope: "read" | "write" } | null
}

export async function createContext(services: Services, headers: Headers): Promise<Context> {
  const session = await services.auth.api.getSession({ headers }).catch(() => null)
  return { ...services, headers, session, apiKey: null }
}
