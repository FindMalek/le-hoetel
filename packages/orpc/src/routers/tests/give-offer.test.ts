import { afterAll, beforeAll, expect, test } from "bun:test"
import { messages } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

async function setup(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const staff = await app.joinHotel(await app.signUp(`${slug}-desk@ritorno.test`), hotelId, "staff")
  const offer = await client.offers.create({ title: "Late check-out", promoCode: "LATE" })
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620444444",
    language: "fr",
    email: "amel@example.test",
    source: "qr_room",
    consents: { email: true, whatsapp: false, profile: false },
  })
  return { desk: staff.client, gift: { guestId: guest.id, offerId: offer.id } }
}

test("staff give an offer, show the same code again, and redeem it once", async () => {
  const { desk, gift } = await setup("give-redeem")
  const other = await setup("give-other")

  const given = await desk.offers.give(gift)
  expect(given).toMatchObject({ state: "ready", channels: ["email"] })
  expect(given.qrSvg).toContain("<svg")
  expect((await desk.offers.give(gift)).code).toBe(given.code)
  await expect(other.desk.offers.give(gift)).rejects.toThrow("not found")

  expect(await desk.offers.redeem({ code: given.code })).toMatchObject({ status: "redeemed", justNow: true })
  expect(await desk.offers.give(gift)).toMatchObject({ code: given.code, state: "redeemed" })
  await expect(desk.offers.send({ ...gift, channel: "email" })).rejects.toThrow("cannot be redeemed")
})

test("a given offer is sent only on a consented channel, and not twice in a row", async () => {
  const { desk, gift } = await setup("give-send")
  const { code } = await desk.offers.give(gift)

  expect(await desk.offers.send({ ...gift, channel: "whatsapp" })).toEqual({ status: "skipped_no_consent" })
  expect(await desk.offers.send({ ...gift, channel: "email" })).toEqual({ status: "sent" })
  await expect(desk.offers.send({ ...gift, channel: "email" })).rejects.toThrow("Too many requests")

  const sent = await app.services.db.select().from(messages).where(eq(messages.guestId, gift.guestId))
  const email = sent.find((message) => message.channel === "email")
  expect(JSON.stringify(email?.preview)).toContain(code)
})
