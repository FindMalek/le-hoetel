import { afterAll, beforeAll, expect, test } from "bun:test"
import { INVITATION_ID_HEADER } from "@ritorno/common/constants"
import { invitation, member } from "@ritorno/db"
import { createTestDb, type TestDb } from "@ritorno/db/testing"
import { eq } from "drizzle-orm"
import { type Auth, createAuth } from "../index"

const ORIGIN = "http://localhost:3002"
const PASSWORD = "correct horse battery"

let testDb: TestDb
let auth: Auth
beforeAll(async () => {
  testDb = await createTestDb()
  auth = createAuth({
    db: testDb.db,
    secret: "test-secret-test-secret-test-secret!",
    dashboardUrl: ORIGIN,
    trustedOrigins: [ORIGIN],
    secureCookies: false,
  })
})
afterAll(() => testDb.close())

const post = (path: string, body: object, headers: Record<string, string> = {}) =>
  auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    }),
  )

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")

/** A hotel owned by a server-created user, the way the app admin onboards one. */
async function hotel(slug: string) {
  const { user } = await auth.api.signUpEmail({
    body: { email: `${slug}@ritorno.test`, password: PASSWORD, name: slug },
  })
  const created = await auth.api.createOrganization({ body: { name: slug, slug, userId: user.id } })
  const signIn = await post("/sign-in/email", { email: `${slug}@ritorno.test`, password: PASSWORD })
  return { userId: user.id, hotelId: created!.id, cookie: cookieOf(signIn) }
}

async function invite(email: string) {
  const { userId, hotelId } = await hotel(`inviter-${crypto.randomUUID().slice(0, 8)}`)
  const id = crypto.randomUUID()
  await testDb.db.insert(invitation).values({
    id,
    organizationId: hotelId,
    email,
    role: "staff",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
    inviterId: userId,
  })
  return { id, inviterId: userId }
}

const signUp = (body: { email: string; password: string; name: string }, invitationId?: string) =>
  post("/sign-up/email", body, invitationId ? { [INVITATION_ID_HEADER]: invitationId } : {})

test("sign up over http needs the id of a pending invitation for that email", async () => {
  const body = { email: "stranger@ritorno.test", password: PASSWORD, name: "Stranger" }
  const other = await invite("someone-else@ritorno.test")
  expect((await signUp(body, other.id)).status).toBe(403)
  const own = await invite(body.email)
  expect((await signUp(body)).status).toBe(403)
  expect((await signUp(body, other.id)).status).toBe(403)
  expect((await signUp(body, own.id)).status).toBe(200)
})

test("an invitation whose sender left the hotel opens no account", async () => {
  const body = { email: "orphaned@ritorno.test", password: PASSWORD, name: "Orphaned" }
  const { id, inviterId } = await invite(body.email)
  await testDb.db.delete(member).where(eq(member.userId, inviterId))
  expect((await signUp(body, id)).status).toBe(403)
})

test("a magic link signs up an invited address without the id, the mailbox is proven", async () => {
  const links = new Map<string, string>()
  const withLink = createAuth({
    db: testDb.db,
    secret: "test-secret-test-secret-test-secret!",
    dashboardUrl: ORIGIN,
    trustedOrigins: [ORIGIN],
    secureCookies: false,
    sendMagicLink: async (email, url) => void links.set(email, url),
  })
  const open = async (email: string) => {
    await withLink.api.signInMagicLink({ body: { email }, headers: new Headers() })
    return withLink.handler(new Request(links.get(email)!))
  }

  await invite("linked@ritorno.test")
  expect((await open("linked@ritorno.test")).headers.getSetCookie().join()).toContain("session_token")
  expect((await open("uninvited@ritorno.test")).headers.getSetCookie().join()).not.toContain("session_token")
})

test("github signs up an invited address only when github has verified it", async () => {
  const withGithub = createAuth({
    db: testDb.db,
    secret: "test-secret-test-secret-test-secret!",
    dashboardUrl: ORIGIN,
    trustedOrigins: [ORIGIN],
    secureCookies: false,
    github: { clientId: "id", clientSecret: "secret" },
  })
  const email = "octo@ritorno.test"
  await invite(email)
  let verified = false
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes("access_token")) return Response.json({ access_token: "token", token_type: "bearer" })
    if (url.includes("/user/emails")) return Response.json([{ email, primary: true, verified }])
    return Response.json({ id: 1, login: "octo", name: "Octo", email })
  }) as typeof fetch

  const callback = async () => {
    const started = await withGithub.api.signInSocial({
      body: { provider: "github", callbackURL: "/" },
      asResponse: true,
    })
    const { url } = (await started.json()) as { url: string }
    const state = new URL(url).searchParams.get("state")
    return withGithub.handler(
      new Request(`${ORIGIN}/api/auth/callback/github?code=code&state=${state}`, {
        headers: { cookie: cookieOf(started) },
      }),
    )
  }

  try {
    expect((await callback()).headers.get("location")).toContain("INVITATION_REQUIRED")
    verified = true
    expect((await callback()).headers.getSetCookie().join()).toContain("session_token")
  } finally {
    globalThis.fetch = realFetch
  }
})

test("a hotel can't be deleted, renamed or re-slugged through the auth routes", async () => {
  const { hotelId, cookie } = await hotel("kept-slug")
  const send = (path: string, body: object) =>
    auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, cookie },
        body: JSON.stringify(body),
      }),
    )

  expect((await send("/organization/delete", { organizationId: hotelId })).ok).toBe(false)
  expect((await send("/organization/update", { organizationId: hotelId, data: { slug: "moved" } })).status).toBe(403)
  expect((await send("/organization/update", { organizationId: hotelId, data: { name: "Renamed" } })).status).toBe(403)
  const kept = await auth.api.getFullOrganization({
    query: { organizationId: hotelId },
    headers: new Headers({ cookie }),
  })
  expect(kept).toMatchObject({ slug: "kept-slug", name: "kept-slug" })
})

test("sign up, sign in and read the session through the real handlers", async () => {
  const email = "ada@ritorno.test"
  const { id } = await invite(email)
  expect((await signUp({ email, password: PASSWORD, name: "Ada" }, id)).status).toBe(200)

  const signIn = await post("/sign-in/email", { email, password: PASSWORD })
  expect(signIn.status).toBe(200)
  const cookie = cookieOf(signIn)

  const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
  expect(session?.user).toMatchObject({ email, name: "Ada" })
})

test("a wrong password or a short one is refused", async () => {
  const { id } = await invite("grace@ritorno.test")
  await signUp({ email: "grace@ritorno.test", password: PASSWORD, name: "Grace" }, id)
  expect((await post("/sign-in/email", { email: "grace@ritorno.test", password: "not the password" })).status).toBe(401)
  expect((await post("/sign-up/email", { email: "short@ritorno.test", password: "short", name: "S" })).status).toBe(400)
})

test("an email can only sign up once", async () => {
  const body = { email: "once@ritorno.test", password: PASSWORD, name: "Once" }
  const { id } = await invite(body.email)
  expect((await signUp(body, id)).status).toBe(200)
  expect((await signUp(body, id)).status).toBeGreaterThanOrEqual(400)
})

test("a password reset ends the sessions opened with the old password", async () => {
  let token = ""
  const withReset = createAuth({
    db: testDb.db,
    secret: "test-secret-test-secret-test-secret!",
    dashboardUrl: ORIGIN,
    trustedOrigins: [ORIGIN],
    secureCookies: false,
    sendResetPassword: async (_user, url) => {
      token = new URL(url).pathname.split("/").pop()!
    },
  })
  const email = "taken-first@ritorno.test"
  await withReset.api.signUpEmail({ body: { email, password: PASSWORD, name: "first" } })
  const signIn = await withReset.api.signInEmail({ body: { email, password: PASSWORD }, asResponse: true })
  const headers = new Headers({ cookie: cookieOf(signIn) })
  expect(await withReset.api.getSession({ headers })).not.toBeNull()

  await withReset.api.requestPasswordReset({ body: { email } })
  await Bun.sleep(50)
  await withReset.api.resetPassword({ body: { token, newPassword: "a different long password" } })

  // past the short lived cookie cache, which would still answer for a few minutes
  expect(await withReset.api.getSession({ headers, query: { disableCookieCache: true } })).toBeNull()
})
