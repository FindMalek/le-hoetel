import { afterAll, beforeAll, expect, test } from "bun:test"
import { invitation } from "@ritorno/db"
import { createTestDb, type TestDb } from "@ritorno/db/testing"
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

const post = (path: string, body: object) =>
  auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
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
  await testDb.db.insert(invitation).values({
    id: crypto.randomUUID(),
    organizationId: hotelId,
    email,
    role: "staff",
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000),
    inviterId: userId,
  })
}

test("sign up over http is refused unless the email has a pending invitation", async () => {
  const body = { email: "stranger@ritorno.test", password: PASSWORD, name: "Stranger" }
  expect((await post("/sign-up/email", body)).status).toBe(403)
  await invite(body.email)
  expect((await post("/sign-up/email", body)).status).toBe(200)
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
  await invite(email)
  expect((await post("/sign-up/email", { email, password: PASSWORD, name: "Ada" })).status).toBe(200)

  const signIn = await post("/sign-in/email", { email, password: PASSWORD })
  expect(signIn.status).toBe(200)
  const cookie = cookieOf(signIn)

  const session = await auth.api.getSession({ headers: new Headers({ cookie }) })
  expect(session?.user).toMatchObject({ email, name: "Ada" })
})

test("a wrong password or a short one is refused", async () => {
  await invite("grace@ritorno.test")
  await post("/sign-up/email", { email: "grace@ritorno.test", password: PASSWORD, name: "Grace" })
  expect((await post("/sign-in/email", { email: "grace@ritorno.test", password: "not the password" })).status).toBe(401)
  expect((await post("/sign-up/email", { email: "short@ritorno.test", password: "short", name: "S" })).status).toBe(400)
})

test("an email can only sign up once", async () => {
  const body = { email: "once@ritorno.test", password: PASSWORD, name: "Once" }
  await invite(body.email)
  expect((await post("/sign-up/email", body)).status).toBe(200)
  expect((await post("/sign-up/email", body)).status).toBeGreaterThanOrEqual(400)
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
