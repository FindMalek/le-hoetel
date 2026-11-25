import { afterAll, beforeAll, expect, test } from "bun:test"
import { hotelSettings, messages } from "@le-hoetel/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

async function hotelOwner(slug: string) {
  const owner = await app.signUp(`${slug}@le-hoetel.test`)
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
