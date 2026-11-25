import { afterAll, beforeAll, expect, test } from "bun:test"
import { guests, messages, offerCodes, offerRedemptions, offers, surveyInvites, surveyResponses } from "@le-hoetel/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../testing"
import { bucketStarts } from "./metrics"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

async function hotelOwner(slug: string) {
  const owner = await app.signUp(`${slug}@le-hoetel.test`)
  const hotelId = await app.createHotel(slug, owner)
  return { hotelId, ...(await app.joinHotel(owner, hotelId, "owner")) }
}

test("buckets: 7 days are days, longer periods are weeks starting on a Monday", () => {
  const today = new Date("2026-11-25T00:00:00Z")
  expect(bucketStarts(today, 7).starts).toHaveLength(7)
  expect(bucketStarts(today, 30)).toMatchObject({ bucket: "week", since: "2026-10-27" })
  expect(bucketStarts(today, 30).starts.at(0)).toBe("2026-10-26")
})

test("metrics count only this hotel's guests, consent and messages inside the period", async () => {
  const mine = await hotelOwner("metrics-mine")
  const other = await hotelOwner("metrics-other")
  const add = (client: typeof mine.client, phone: string, source: "qr_room" | "staff", whatsapp: boolean) =>
    client.guests.create({
      name: "Amel Ben Salah",
      phone,
      language: "fr",
      source,
      consents: { email: false, whatsapp, profile: false },
    })
  const a = await add(mine.client, "+21620300001", "qr_room", true)
  const old = await add(mine.client, "+21620300002", "staff", false)
  await add(other.client, "+21620300003", "qr_room", true)
  await app.services.db
    .update(guests)
    .set({ createdAt: new Date(Date.now() - 40 * 86_400_000) })
    .where(eq(guests.id, old.id))
  await app.services.db.insert(messages).values([
    {
      hotelId: mine.hotelId,
      guestId: a.id,
      channel: "whatsapp",
      templateKey: "welcome",
      language: "fr",
      status: "delivered",
    },
    {
      hotelId: mine.hotelId,
      guestId: a.id,
      channel: "whatsapp",
      templateKey: "welcome",
      language: "fr",
      status: "failed",
    },
  ])

  const month = await mine.client.metrics.get({ days: 30 })
  expect(month.captured.total).toBe(1)
  expect(month.captured.bySource.qr_room).toBe(1)
  expect(month.consent).toEqual({ guests: 1, email: 0, whatsapp: 1 })
  expect(month.messages).toEqual({ sent: 1, delivered: 1, failed: 1 })

  const quarter = await mine.client.metrics.get({ days: 90 })
  expect(quarter.captured.total).toBe(2)
})

const DAY = 86_400_000

test("survey score and review clicks count this hotel's answers inside the period", async () => {
  const mine = await hotelOwner("metrics-survey")
  const other = await hotelOwner("metrics-survey-other")
  const answer = async (hotel: typeof mine, phone: string, nps: number, submittedAt: Date, clicked: boolean) => {
    const guest = await hotel.client.guests.create({
      name: "Amel Ben Salah",
      phone,
      language: "fr",
      source: "staff",
      consents: { email: false, whatsapp: false, profile: false },
    })
    const [invite] = await app.services.db
      .insert(surveyInvites)
      .values({ hotelId: hotel.hotelId, guestId: guest.id, expiresAt: new Date(Date.now() + DAY) })
      .returning()
    await app.services.db.insert(surveyResponses).values({
      hotelId: hotel.hotelId,
      guestId: guest.id,
      inviteId: invite!.id,
      nps,
      language: "fr",
      submittedAt,
      reviewLinkClickedAt: clicked ? submittedAt : null,
    })
  }
  await answer(mine, "+21620300011", 4, new Date(), false)
  await answer(mine, "+21620300012", 9, new Date(), true)
  await answer(mine, "+21620300013", 10, new Date(Date.now() - 40 * DAY), true)
  await answer(other, "+21620300014", 10, new Date(), true)

  const month = await mine.client.metrics.get({ days: 30 })
  expect(month.survey).toEqual({ responses: 2, average: 6.5, unhappy: 1 })
  expect(month.reviewsRequested).toBe(1)
})

test("redeemed counts only redemptions of codes issued in the period", async () => {
  const mine = await hotelOwner("metrics-offers")
  const other = await hotelOwner("metrics-offers-other")
  const guest = (hotel: typeof mine, phone: string) =>
    hotel.client.guests.create({
      name: "Amel Ben Salah",
      phone,
      language: "fr",
      source: "staff",
      consents: { email: false, whatsapp: false, profile: false },
    })
  const fresh = await guest(mine, "+21620300021")
  const old = await guest(mine, "+21620300022")
  const theirs = await guest(other, "+21620300023")
  const [offer, otherOffer] = await app.services.db
    .insert(offers)
    .values([
      { hotelId: mine.hotelId, title: "Spa", promoCode: "SPA" },
      { hotelId: other.hotelId, title: "Spa", promoCode: "SPA" },
    ])
    .returning()
  await app.services.db.insert(offerCodes).values([
    { hotelId: mine.hotelId, offerId: offer!.id, guestId: fresh.id, code: "M-FRESH" },
    {
      hotelId: mine.hotelId,
      offerId: offer!.id,
      guestId: old.id,
      code: "M-OLD",
      createdAt: new Date(Date.now() - 40 * DAY),
    },
    { hotelId: other.hotelId, offerId: otherOffer!.id, guestId: theirs.id, code: "O-FRESH" },
  ])
  await app.services.db.insert(offerRedemptions).values([
    { hotelId: mine.hotelId, offerId: offer!.id, guestId: fresh.id },
    { hotelId: mine.hotelId, offerId: offer!.id, guestId: old.id },
    { hotelId: other.hotelId, offerId: otherOffer!.id, guestId: theirs.id },
  ])

  const month = await mine.client.metrics.get({ days: 30 })
  expect(month.offers).toEqual({ issued: 1, redeemed: 1 })
})
