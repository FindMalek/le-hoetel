import { afterAll, beforeAll, expect, test } from "bun:test"
import { signSurveyToken } from "@ritorno/common/survey"
import { guests, hotelSettings, surveyInvites, surveyResponses } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { eq } from "drizzle-orm"
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

async function guestCaptured(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620444444",
    language: "fr",
    email: "amel@example.test",
    source: "staff",
    consents: { email: true, whatsapp: false, profile: false },
  })
  await app.services.db.update(guests).set({ createdAt: CAPTURED }).where(eq(guests.id, guest.id))
  return { hotelId, guestId: guest.id }
}

const runAt = (at: string) => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const job = createMessageJobs(services).find((candidate) => candidate.name === SURVEY_JOB)!
  return job.run({}, { db: app.services.db, now: () => new Date(at), jobId: "t" })
}

test("the survey goes out 24 hours after capture, outside quiet hours, once", async () => {
  const { guestId } = await guestCaptured("survey-once")
  sent.length = 0

  await runAt("2026-06-11T08:00:00Z")
  expect(sent).toHaveLength(0)

  await runAt("2026-06-11T20:30:00Z")
  expect(sent).toHaveLength(0)

  await runAt("2026-06-11T10:00:00Z")
  await runAt("2026-06-11T11:00:00Z")
  expect(sent).toHaveLength(1)
  const [invite] = await app.services.db.select().from(surveyInvites).where(eq(surveyInvites.guestId, guestId))
  expect(invite?.sentAt).not.toBeNull()
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
