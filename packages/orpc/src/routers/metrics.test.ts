import { afterAll, beforeAll, expect, test } from "bun:test"
import { guests, messages, surveyInvites, surveyResponses } from "@le-hoetel/db"
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

  const [invite] = await app.services.db
    .insert(surveyInvites)
    .values({ hotelId: mine.hotelId, guestId: a.id, expiresAt: new Date(Date.now() + 86_400_000) })
    .returning()
  await app.services.db
    .insert(surveyResponses)
    .values({
      hotelId: mine.hotelId,
      guestId: a.id,
      inviteId: invite!.id,
      nps: 4,
      language: "fr",
      reviewLinkClickedAt: new Date(),
    })

  const month = await mine.client.metrics.get({ days: 30 })
  expect(month.captured.total).toBe(1)
  expect(month.captured.bySource.qr_room).toBe(1)
  expect(month.consent).toEqual({ guests: 1, email: 0, whatsapp: 1 })
  expect(month.messages).toEqual({ sent: 1, delivered: 1, failed: 1 })
  expect(month.survey).toEqual({ responses: 1, average: 4, unhappy: 1 })
  expect(month.reviewsRequested).toBe(1)

  const quarter = await mine.client.metrics.get({ days: 90 })
  expect(quarter.captured.total).toBe(2)
})
