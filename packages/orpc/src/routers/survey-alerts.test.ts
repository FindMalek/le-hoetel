import { afterAll, beforeAll, expect, test } from "bun:test"
import { signSurveyToken } from "@le-hoetel/common/survey"
import { feedbackCases, hotelSettings, surveyInvites } from "@le-hoetel/db"
import type { SendEmailInput } from "@le-hoetel/notification"
import { eq } from "drizzle-orm"
import { submitSurvey } from "../lib/surveys"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const emails: SendEmailInput[] = []
const notification = {
  sendTelegram: async () => ({ channel: "telegram", sent: true }),
  sendEmail: async (input: SendEmailInput) => {
    emails.push(input)
    return { channel: "email", sent: true }
  },
}
const ctx = () => ({ ...app.services, notification: notification as unknown as typeof app.services.notification })

async function invite(slug: string) {
  const owner = await app.signUp(`${slug}@le-hoetel.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620555555",
    language: "fr",
    source: "staff",
    consents: { email: false, whatsapp: false, profile: false },
  })
  const [row] = await app.services.db
    .insert(surveyInvites)
    .values({ hotelId, guestId: guest.id, expiresAt: new Date(Date.now() + 864e5) })
    .returning()
  const token = signSurveyToken(app.services.config.tokenSecret, "survey", { hotelId, inviteId: row!.id })
  return { hotelId, token }
}

const cases = (hotelId: string) =>
  app.services.db.select().from(feedbackCases).where(eq(feedbackCases.hotelId, hotelId))

test("a score at or below the default threshold opens a new case and alerts the manager", async () => {
  const { hotelId, token } = await invite("survey-low")
  emails.length = 0

  await submitSurvey(ctx(), token, { nps: 6, comment: "Pas de clim la nuit" })

  expect(await cases(hotelId)).toMatchObject([{ status: "new", hotelId }])
  expect(emails).toHaveLength(1)
  const text = emails[0]!.email.text ?? ""
  expect(text).toContain("Amel")
  expect(text).toContain("6/10")
  expect(text).toContain("Pas de clim")
  expect(text).toContain("/feedback/")
  expect(text).not.toContain("+216")
})

test("a score above the threshold stays quiet, and the hotel can move the threshold", async () => {
  const quiet = await invite("survey-high")
  emails.length = 0
  await submitSurvey(ctx(), quiet.token, { nps: 7 })
  expect(await cases(quiet.hotelId)).toHaveLength(0)
  expect(emails).toHaveLength(0)

  const strict = await invite("survey-strict")
  await app.services.db
    .update(hotelSettings)
    .set({ lowScoreThreshold: 8 })
    .where(eq(hotelSettings.organizationId, strict.hotelId))
  await submitSurvey(ctx(), strict.token, { nps: 8 })
  expect(await cases(strict.hotelId)).toHaveLength(1)
  expect(emails).toHaveLength(1)
})
