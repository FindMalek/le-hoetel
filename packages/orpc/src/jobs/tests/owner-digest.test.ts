import { afterAll, beforeAll, expect, test } from "bun:test"
import { guests, hotelSettings } from "@ritorno/db"
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
let failure: Error | null = null
const notification = {
  live: false,
  channels: [],
  sendEmail: async (input: SendEmailInput) => {
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
  return { hotelId, client, email: `${slug}@ritorno.test` }
}

const runAt = (at: string) => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const job = createMessageJobs(services, { pauseMs: 0 }).find((candidate) => candidate.name === OWNER_DIGEST_JOB)!
  return job.run({}, { db: app.services.db, now: () => new Date(at), jobId: "t" })
}

const to = (email: string) => sent.filter((mail) => mail.to === email)

test("the owner gets last week's counts once, on Monday after 09:00 hotel time, with no guest details", async () => {
  const { client, email } = await hotel("digest-once")
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
  expect(mail!.email.html).toContain("/hotel#weekly-digest")
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

test("a rate limited send is retried the next hour", async () => {
  const { email } = await hotel("digest-retry")
  failure = Object.assign(new Error("slow down"), { status: 429 })
  await runAt("2026-07-06T08:05:00Z")
  failure = null

  await runAt("2026-07-06T09:05:00Z")
  expect(to(email)).toHaveLength(1)
})
