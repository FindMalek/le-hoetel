import { afterAll, beforeAll, expect, test } from "bun:test"
import { feedbackCases, guestVisits, hotelSettings, messages, surveyResponses } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

async function hotelOwner(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  return { hotelId, client }
}

test("the overview counts one hotel's guests, consent and messages, and the checklist reads real state", async () => {
  const mine = await hotelOwner("overview-mine")
  const other = await hotelOwner("overview-other")
  const guest = (client: typeof mine.client, phone: string, email: boolean) =>
    client.guests.create({
      name: "Amel Ben Salah",
      phone,
      language: "fr",
      email: email ? `${phone.slice(-4)}@example.test` : null,
      source: "qr_room",
      consents: { email, whatsapp: false, profile: false },
    })
  const first = await guest(mine.client, "+21620111111", true)
  await guest(mine.client, "+21620111112", false)
  await guest(other.client, "+21620111113", true)
  await app.services.db.insert(messages).values([
    {
      hotelId: mine.hotelId,
      guestId: first.id,
      channel: "email",
      templateKey: "welcome",
      language: "fr",
      status: "sent",
    },
    {
      hotelId: mine.hotelId,
      guestId: first.id,
      channel: "email",
      templateKey: "welcome",
      language: "fr",
      status: "failed",
    },
  ])
  await app.services.db
    .update(hotelSettings)
    .set({ primaryColor: "#0a7c66" })
    .where(eq(hotelSettings.organizationId, mine.hotelId))

  const overview = await mine.client.overview.get()
  expect(overview.guests).toEqual({ total: 2, today: 2, week: 2, consented: 1 })
  expect(overview.messagesSent).toEqual({ today: 1, week: 1 })
  expect(overview.offersRedeemed).toEqual({ today: 0, week: 0 })
  expect(overview.checklist).toEqual({
    logo: false,
    colors: true,
    googleLink: false,
    qr: true,
    guests: true,
    testEmail: false,
  })
  expect(await mine.client.guests.messages({ id: first.id })).toHaveLength(2)
  await expect(other.client.guests.messages({ id: first.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
})

test("logo, review link and test email tick the checklist of that hotel only, and open again with the data", async () => {
  const mine = await hotelOwner("checklist-mine")
  const other = await hotelOwner("checklist-other")
  await app.services.db
    .update(hotelSettings)
    .set({ logoKey: "hotels/checklist/public/logo.png" })
    .where(eq(hotelSettings.organizationId, mine.hotelId))
  await mine.client.hotel.update({ googleReviewUrl: "https://g.page/r/example" })
  await mine.client.emails.sendTest({ template: "welcome", locale: "fr" })

  expect((await mine.client.overview.get()).checklist).toMatchObject({ logo: true, googleLink: true, testEmail: true })
  expect((await other.client.overview.get()).checklist).toMatchObject({
    logo: false,
    googleLink: false,
    testEmail: false,
  })

  await mine.client.hotel.update({ googleReviewUrl: null })
  expect((await mine.client.overview.get()).checklist.googleLink).toBe(false)
})

test("last week compares with the week before, and only this hotel's unhandled low scores are alerts", async () => {
  const mine = await hotelOwner("overview-week")
  const other = await hotelOwner("overview-week-other")
  const add = (client: typeof mine.client, phone: string) =>
    client.guests.create({
      name: "Sami Trabelsi",
      phone,
      language: "ar",
      source: "staff",
      consents: { email: false, whatsapp: false, profile: false },
    })
  const sami = await add(mine.client, "+21620222221")
  const stranger = await add(other.client, "+21620222222")
  const daysAgo = (days: number) => new Date(Date.now() - days * 864e5)
  await app.services.db.insert(guestVisits).values([
    { hotelId: mine.hotelId, guestId: sami.id, source: "staff", at: daysAgo(20) },
    { hotelId: mine.hotelId, guestId: sami.id, source: "staff", at: daysAgo(10) },
    { hotelId: mine.hotelId, guestId: sami.id, source: "staff", at: daysAgo(2) },
  ])
  const respond = (hotelId: string, guestId: string, nps: number, days: number) =>
    app.services.db
      .insert(surveyResponses)
      .values({ hotelId, guestId, inviteId: crypto.randomUUID(), nps, language: "ar", submittedAt: daysAgo(days) })
      .returning()
      .then(([row]) => row!)
  const low = await respond(mine.hotelId, sami.id, 3, 1)
  const handled = await respond(mine.hotelId, sami.id, 9, 9)
  const elsewhere = await respond(other.hotelId, stranger.id, 2, 1)
  await app.services.db.insert(feedbackCases).values([
    { hotelId: mine.hotelId, responseId: low.id, status: "new" },
    { hotelId: mine.hotelId, responseId: handled.id, status: "resolved" },
    { hotelId: other.hotelId, responseId: elsewhere.id, status: "new" },
  ])

  const { lastWeek, alerts } = await mine.client.overview.get()
  expect(lastWeek.returning).toEqual({ current: 1, previous: 1 })
  expect(lastWeek.survey).toEqual({ current: 3, previous: 9, responses: 1 })
  expect(lastWeek.guests).toEqual({ current: 1, previous: 0 })
  expect(alerts.open).toBe(1)
  expect(alerts.items).toMatchObject([{ guestId: sami.id, nps: 3, phoneE164: "+21620222221" }])
})
