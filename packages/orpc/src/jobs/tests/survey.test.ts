import { afterAll, beforeAll, expect, test } from "bun:test"
import { signSurveyToken } from "@ritorno/common/survey"
import { guests, hotelSettings, surveyInvites, surveyResponses } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { and, eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"
import { createMessageJobs } from "../index"
import { SURVEY_JOB } from "../survey"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const sent: SendEmailInput[] = []
const notification = {
  live: false,
  channels: [],
  sendEmail: async (input: SendEmailInput) => {
    sent.push(input)
    return { channel: "email", sent: false }
  },
}

const CAPTURED = new Date("2026-06-10T09:00:00Z")

async function guestCaptured(slug: string, source: "staff" | "qr_table" = "staff") {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620444444",
    language: "fr",
    email: "amel@example.test",
    source,
    consents: { email: true, whatsapp: false, profile: false },
  })
  await app.services.db.update(guests).set({ createdAt: CAPTURED }).where(eq(guests.id, guest.id))
  return { hotelId, guestId: guest.id }
}

const runAt = (at: string, batchSize?: number) => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const pacing = batchSize ? { batchSize, pauseMs: 0 } : {}
  const job = createMessageJobs(services, pacing).find((candidate) => candidate.name === SURVEY_JOB)!
  return job.run({}, { db: app.services.db, now: () => new Date(at), jobId: "t" })
}

test("with no check-out the survey waits 8 days after capture, outside quiet hours, once", async () => {
  const { guestId } = await guestCaptured("survey-once")
  sent.length = 0

  await runAt("2026-06-11T10:00:00Z")
  await runAt("2026-06-18T08:00:00Z")
  expect(sent).toHaveLength(0)

  await runAt("2026-06-18T20:30:00Z")
  expect(sent).toHaveLength(0)

  await runAt("2026-06-18T10:00:00Z")
  await runAt("2026-06-18T11:00:00Z")
  expect(sent).toHaveLength(1)
  const [invite] = await app.services.db.select().from(surveyInvites).where(eq(surveyInvites.guestId, guestId))
  expect(invite?.sentAt).not.toBeNull()
})

test("a table guest is only surveyed once a check-out is known", async () => {
  const { guestId } = await guestCaptured("survey-table", "qr_table")
  sent.length = 0

  await runAt("2026-06-18T10:00:00Z")
  expect(sent).toHaveLength(0)

  await app.services.db.update(guests).set({ stayCheckOut: "2026-06-18" }).where(eq(guests.id, guestId))
  await runAt("2026-06-19T12:00:00Z")
  expect(sent).toHaveLength(1)
})

test("an imported guest is surveyed only after a real check-out inside the survey window", async () => {
  const owner = await app.signUp("survey-csv@ritorno.test")
  const hotelId = await app.createHotel("survey-csv", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  await client.guests.import({
    rows: [
      {
        line: 2,
        name: "No stay",
        phone: "20 777 777",
        email: "nostay@example.test",
        emailConsent: "yes",
        whatsappConsent: "yes",
      },
      {
        line: 3,
        name: "Stayed",
        phone: "20 888 888",
        email: "stayed@example.test",
        emailConsent: "yes",
        whatsappConsent: "yes",
      },
    ],
    defaultLanguage: "fr",
    confirmConsent: true,
  })
  await app.services.db.update(guests).set({ createdAt: CAPTURED }).where(eq(guests.hotelId, hotelId))
  await app.services.db
    .update(guests)
    .set({ stayCheckOut: "2026-06-10" })
    .where(and(eq(guests.hotelId, hotelId), eq(guests.name, "Stayed")))
  sent.length = 0

  await runAt("2026-06-11T13:00:00Z")

  expect(sent.map((message) => message.to)).toEqual(["stayed@example.test"])
})

test("a survey is answered once per invite and expires after 14 days", async () => {
  const { hotelId, guestId } = await guestCaptured("survey-answer")
  const [invite] = await app.services.db
    .insert(surveyInvites)
    .values({ hotelId, guestId, expiresAt: new Date(Date.now() + 864e5) })
    .returning()
  const token = signSurveyToken(app.services.config.tokenSecret, "survey", { hotelId, inviteId: invite!.id })

  expect(await app.anonymous.public.survey.get({ token })).toMatchObject({ state: "open", language: "fr" })
  await app.anonymous.public.survey.submit({ token, nps: 9, comment: "Merci" })
  await app.anonymous.public.survey.submit({ token, nps: 2 })

  const rows = await app.services.db.select().from(surveyResponses).where(eq(surveyResponses.inviteId, invite!.id))
  expect(rows).toMatchObject([{ nps: 9, comment: "Merci", hotelId, guestId }])
  expect(await app.anonymous.public.survey.get({ token })).toMatchObject({ state: "answered" })

  const other = await guestCaptured("survey-old")
  const [stale] = await app.services.db
    .insert(surveyInvites)
    .values({ ...other, expiresAt: new Date(Date.now() - 1000) })
    .returning()
  const old = signSurveyToken(app.services.config.tokenSecret, "survey", {
    hotelId: other.hotelId,
    inviteId: stale!.id,
  })
  expect(app.anonymous.public.survey.submit({ token: old, nps: 8 })).rejects.toThrow()
})

test("Share on Google is offered after any score, hidden without a link, and a click is stamped once", async () => {
  const { hotelId, guestId } = await guestCaptured("survey-review")
  const [invite] = await app.services.db
    .insert(surveyInvites)
    .values({ hotelId, guestId, expiresAt: new Date(Date.now() + 864e5) })
    .returning()
  const secret = app.services.config.tokenSecret
  const token = signSurveyToken(secret, "survey", { hotelId, inviteId: invite!.id })
  await app.anonymous.public.survey.submit({ token, nps: 2 })

  expect((await app.anonymous.public.survey.get({ token })).reviewToken).toBeNull()
  await app.services.db
    .update(hotelSettings)
    .set({ googleReviewUrl: "https://g.page/r/dar-amel/review" })
    .where(eq(hotelSettings.organizationId, hotelId))
  const { reviewToken } = await app.anonymous.public.survey.get({ token })
  expect(reviewToken).toBeString()

  expect(await app.anonymous.public.survey.review({ token: reviewToken! })).toEqual({
    url: "https://g.page/r/dar-amel/review",
  })
  const [first] = await app.services.db.select().from(surveyResponses).where(eq(surveyResponses.inviteId, invite!.id))
  await app.anonymous.public.survey.review({ token: reviewToken! })
  const [second] = await app.services.db.select().from(surveyResponses).where(eq(surveyResponses.inviteId, invite!.id))
  expect(first?.reviewLinkClickedAt).not.toBeNull()
  expect(second?.reviewLinkClickedAt).toEqual(first!.reviewLinkClickedAt!)
  expect(app.anonymous.public.survey.review({ token })).rejects.toThrow()
})

test("one run surveys only a batch per hotel, and a guest without consent takes no place in it", async () => {
  const owner = await app.signUp("survey-batch@ritorno.test")
  const hotelId = await app.createHotel("survey-batch", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  for (const [n, email] of [false, true, true].entries()) {
    const guest = await client.guests.create({
      name: "Amel",
      phone: `+2162044400${n}`,
      language: "fr",
      email: `batch-${n}@example.test`,
      source: "staff",
      consents: { email, whatsapp: false, profile: false },
    })
    // the one without consent has been due the longest
    const createdAt = new Date(CAPTURED.getTime() + n * 60_000)
    await app.services.db.update(guests).set({ createdAt }).where(eq(guests.id, guest.id))
  }
  const mine = () => sent.filter((message) => message.to.startsWith("batch-")).map((message) => message.to)

  await runAt("2026-06-18T10:00:00Z", 1)
  expect(mine()).toEqual(["batch-1@example.test"])
  await runAt("2026-06-18T10:01:00Z", 1)
  expect(mine()).toEqual(["batch-1@example.test", "batch-2@example.test"])
})
