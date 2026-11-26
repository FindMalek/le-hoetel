import { afterAll, beforeAll, expect, test } from "bun:test"
import { feedbackCases, guests, hotelSettings, messages, surveyInvites, surveyResponses } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"
import { createMessageJobs } from "../index"
import { OWNER_DIGEST_JOB } from "../owner-digest"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const sent: SendEmailInput[] = []
const failures = new Map<string, Error>()
const notification = {
  live: false,
  channels: [],
  sendEmail: async (input: SendEmailInput) => {
    const failure = failures.get(input.to)
    if (failure) throw failure
    sent.push(input)
    return { channel: "email", sent: false }
  },
}

async function hotel(slug: string, set: Partial<typeof hotelSettings.$inferInsert> = {}) {
  const user = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, user)
  const { client } = await app.joinHotel(user, hotelId, "owner")
  await app.services.db
    .update(hotelSettings)
    .set({ timezone: "Africa/Tunis", defaultLanguage: "en", ...set })
    .where(eq(hotelSettings.organizationId, hotelId))
  return { hotelId, user, client, email: `${slug}@ritorno.test` }
}

const runAt = (at: string) => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const job = createMessageJobs(services, { pauseMs: 0 }).find((candidate) => candidate.name === OWNER_DIGEST_JOB)!
  return job.run({}, { db: app.services.db, now: () => new Date(at), jobId: "t" })
}

const to = (email: string) => sent.filter((mail) => mail.to === email)

test("the owner gets last week's counts once, on Monday after 09:00 hotel time, with no guest details", async () => {
  const { hotelId, client, email } = await hotel("digest-once")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620444444",
    language: "fr",
    email: "amel@example.test",
    source: "staff",
    consents: { email: true, whatsapp: false, profile: false },
  })
  // Monday 00:30 in Tunis is still Sunday in UTC, and belongs to the new week.
  await app.services.db
    .update(guests)
    .set({ createdAt: new Date("2026-06-14T22:00:00Z") })
    .where(eq(guests.id, guest.id))

  await runAt("2026-06-14T10:00:00Z") // Sunday
  await runAt("2026-06-15T07:30:00Z") // Monday 08:30 in Tunis
  await runAt("2026-06-15T20:30:00Z") // Monday 21:30, quiet hours
  expect(to(email)).toHaveLength(0)

  await runAt("2026-06-15T08:05:00Z")
  await runAt("2026-06-15T09:05:00Z")
  expect(to(email)).toHaveLength(1)
  const [mail] = to(email)
  expect(mail!.email.text).toMatch(/New guests\s+\u2068?1\u2069? \(week before: \u2068?0/)
  expect(mail!.email.html).toContain(`/hotel?hotel=${hotelId}#weekly-digest`)
  expect(`${mail!.email.html}${mail!.email.text}`).not.toMatch(/Amel|20444444|amel@example/)

  await runAt("2026-06-22T08:05:00Z")
  expect(to(email)).toHaveLength(2)
})

test("a suspended hotel and an owner who turned it off get nothing", async () => {
  const suspended = await hotel("digest-suspended", { status: "suspended" })
  const off = await hotel("digest-off")
  expect((await off.client.hotel.update({ weeklyDigest: false })).weeklyDigest).toBe(false)

  await runAt("2026-06-15T08:05:00Z")
  expect(to(suspended.email)).toHaveLength(0)
  expect(to(off.email)).toHaveLength(0)
})

async function secondOwner(slug: string, hotelId: string) {
  const email = `${slug}-two@ritorno.test`
  const { id } = await app.signUp(email)
  await app.services.auth.api.addMember({ body: { userId: id, role: "owner", organizationId: hotelId } })
  return email
}

test("two runs at the same time send once", async () => {
  const { email } = await hotel("digest-race")
  await Promise.all([runAt("2026-06-29T08:05:00Z"), runAt("2026-06-29T08:05:00Z")])
  expect(to(email)).toHaveLength(1)
})

test("one owner failing leaves the other served; only a retryable failure is tried again", async () => {
  const limited = await hotel("digest-limited")
  const limitedTwo = await secondOwner("digest-limited", limited.hotelId)
  const bounced = await hotel("digest-bounced")
  const bouncedTwo = await secondOwner("digest-bounced", bounced.hotelId)
  failures.set(limitedTwo, Object.assign(new Error("slow down"), { status: 429 }))
  failures.set(bouncedTwo, Object.assign(new Error("bad address"), { status: 422 }))

  await runAt("2026-07-06T08:05:00Z")
  expect(to(limited.email)).toHaveLength(1)
  expect(to(bounced.email)).toHaveLength(1)
  failures.clear()
  await runAt("2026-07-06T09:05:00Z")

  expect(to(limitedTwo)).toHaveLength(1)
  // Sent again with the same key, which Resend drops.
  expect(new Set(to(limited.email).map((mail) => mail.idempotencyKey)).size).toBe(1)
  expect(to(bounced.email)).toHaveLength(1)
  expect(to(bouncedTwo)).toHaveLength(0)
})

test("another hotel's rows are not counted", async () => {
  const quiet = await hotel("digest-quiet")
  const busy = await hotel("digest-busy")
  const { hotelId } = busy
  const { db } = app.services
  const at = new Date("2026-07-08T10:00:00Z")
  const guest = await busy.client.guests.create({
    name: "Sami Trabelsi",
    phone: "+21620555555",
    language: "fr",
    source: "staff",
    consents: { email: false, whatsapp: false, profile: false },
  })
  await db.update(guests).set({ createdAt: at }).where(eq(guests.id, guest.id))
  await db.insert(messages).values({
    hotelId,
    guestId: guest.id,
    channel: "email",
    templateKey: "welcome",
    language: "fr",
    status: "sent",
    createdAt: at,
  })
  const [invite] = await db
    .insert(surveyInvites)
    .values({ hotelId, guestId: guest.id, expiresAt: at })
    .returning({ id: surveyInvites.id })
  const [response] = await db
    .insert(surveyResponses)
    .values({ hotelId, guestId: guest.id, inviteId: invite!.id, nps: 2, language: "fr", submittedAt: at })
    .returning({ id: surveyResponses.id })
  await db.insert(feedbackCases).values({ hotelId, responseId: response!.id })

  await runAt("2026-07-13T08:05:00Z")

  expect(to(busy.email).at(-1)!.email.text).toContain("Unhappy guests")
  const text = to(quiet.email).at(-1)!.email.text
  expect(text).toContain("A quiet week")
  expect(text).not.toMatch(/Unhappy guests|Average score/)
})

test("a week that fails to build is not claimed", async () => {
  const { hotelId, email } = await hotel("digest-broken")
  const { dashboardUrl } = app.services.config
  // Reading the url happens while the email is built.
  Object.defineProperty(app.services.config, "dashboardUrl", {
    configurable: true,
    get: () => {
      throw new Error("boom")
    },
  })
  await runAt("2026-07-20T08:05:00Z")
  Object.defineProperty(app.services.config, "dashboardUrl", {
    configurable: true,
    writable: true,
    value: dashboardUrl,
  })
  const [row] = await app.services.db
    .select({ week: hotelSettings.lastDigestWeek })
    .from(hotelSettings)
    .where(eq(hotelSettings.organizationId, hotelId))
  expect(row!.week).toBeNull()

  await runAt("2026-07-20T09:05:00Z")
  expect(to(email)).toHaveLength(1)
})
