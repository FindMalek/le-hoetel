import type { Auth, Session } from "@ritorno/auth"
import { type Db, user } from "@ritorno/db"
import type { Jobs } from "@ritorno/jobs"
import type { Notifier } from "@ritorno/notification"
import type { Storage } from "@ritorno/storage"
import type { LanguageModel } from "ai"
import { eq } from "drizzle-orm"
import type { RateLimiter } from "./lib/rate-limit"

/** Everything procedures need, built once by the api at startup (and by tests with their own). */
export interface Services {
  db: Db
  auth: Auth
  now: () => Date
  config: {
    deployEnv: string
    gitSha?: string
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
    /** The Telegram bot's username, for the manager link `https://t.me/<bot>?start=<code>`. */
    telegramBot?: string
    /** Where a new demo request is emailed. */
    leadsEmail?: string
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
  const cached = await services.auth.api.getSession({ headers }).catch(() => null)
  // The session cookie is cached for minutes, so a ban would only bite once it expires: read the flag on every call.
  const [row] = cached
    ? await services.db.select({ banned: user.banned }).from(user).where(eq(user.id, cached.user.id))
    : []
  const session = cached && row && !row.banned ? cached : null
  return { ...services, headers, session, apiKey: null }
}
