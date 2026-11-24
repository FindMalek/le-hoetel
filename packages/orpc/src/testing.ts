import { createAuth } from "@le-hoetel/auth"
import { user } from "@le-hoetel/db"
import { createTestDb, type TestDb } from "@le-hoetel/db/testing"
import { createNotifier } from "@le-hoetel/notification"
import type { Storage } from "@le-hoetel/storage"
import { createRouterClient } from "@orpc/server"
import { eq } from "drizzle-orm"
import { createContext, type Services } from "./context"
import { createRateLimiter } from "./lib/rate-limit"
import { appRouter } from "./routers"

const SECRET = "test-secret-test-secret-test-secret!"
const PASSWORD = "correct horse battery"

/** The real services on a throwaway Postgres database: real auth, real router, only the outside world (mail, s3, models) is off. */
export async function createTestApp(options: { storage?: Storage } = {}) {
  const testDb: TestDb = await createTestDb()
  const auth = createAuth({
    db: testDb.db,
    secret: SECRET,
    dashboardUrl: "http://localhost:3002",
    trustedOrigins: ["http://localhost:3002"],
    secureCookies: false,
  })
  const services: Services = {
    db: testDb.db,
    auth,
    now: () => new Date(),
    config: {
      deployEnv: "test",
      githubAuth: false,
      webUrl: "http://localhost:3000",
      dashboardUrl: "http://localhost:3002",
      apiUrl: "http://localhost:3001",
      tokenSecret: SECRET,
    },
    rateLimiter: createRateLimiter({}),
    storage: options.storage ?? null,
    jobs: { enqueue: async () => ({ ok: true, id: null }), list: async () => [] },
    notification: createNotifier({}),
    model: null,
  }

  const clientFor = (headers: Headers) =>
    createRouterClient(appRouter, { context: () => createContext(services, headers) })

  /** Signs a user up and in, as the dashboard does, and returns a client carrying their session cookie. */
  async function signUp(email: string, options: { role?: "admin" } = {}) {
    const created = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: email.split("@")[0] ?? email },
    })
    if (options.role) await services.db.update(user).set({ role: options.role }).where(eq(user.id, created.user.id))
    const login = await auth.api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true })
    const headers = new Headers({
      cookie: login.headers
        .getSetCookie()
        .map((cookie) => cookie.split(";")[0])
        .join("; "),
      "x-csrf-token": "orpc",
    })
    return { id: created.user.id, headers, client: clientFor(headers) }
  }

  type Account = Awaited<ReturnType<typeof signUp>>

  /** Creates a hotel the way the app admin does: an organization owned by `owner`. Returns its id. */
  async function createHotel(slug: string, owner: Account) {
    const created = await auth.api.createOrganization({ body: { name: slug, slug, userId: owner.id } })
    return created!.id
  }

  /** Makes `account` a member with `role` (unless the owner already) and returns it with that hotel active in its session. */
  async function joinHotel(account: Account, hotelId: string, role: "owner" | "manager" | "staff") {
    if (role !== "owner") await auth.api.addMember({ body: { userId: account.id, role, organizationId: hotelId } })
    const switched = await auth.api.setActiveOrganization({
      body: { organizationId: hotelId },
      headers: account.headers,
      returnHeaders: true,
    })
    const jar = new Map<string, string>()
    for (const line of [account.headers.get("cookie") ?? "", ...switched.headers.getSetCookie()]) {
      for (const part of line.split("; ")) jar.set(part.split("=")[0] ?? "", part.split(";")[0] ?? "")
    }
    const headers = new Headers({ cookie: [...jar.values()].join("; "), "x-csrf-token": "orpc" })
    return { id: account.id, headers, client: clientFor(headers) }
  }

  return {
    services,
    createHotel,
    joinHotel,
    anonymous: clientFor(new Headers({ "x-csrf-token": "orpc" })),
    clientFor,
    signUp,
    password: PASSWORD,
    close: testDb.close,
  }
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>
