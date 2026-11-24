import { afterAll, beforeAll, expect, test } from "bun:test"
import { CONSENT_WORDING_VERSION } from "@le-hoetel/common/consent"
import { consentEvents } from "@le-hoetel/db"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const newGuest = {
  name: "Amel Ben Salah",
  phone: "+21620123456",
  language: "fr",
  email: "amel@example.test",
  source: "qr_room",
  consents: { email: true, whatsapp: true, profile: false },
} as const

async function hotelAs(slug: string) {
  const owner = await app.signUp(`${slug}-owner@le-hoetel.test`)
  const hotelId = await app.createHotel(slug, owner)
  return { hotelId, ...(await app.joinHotel(owner, hotelId, "owner")) }
}

test("consent: every change is a logged event with its wording version, an unchanged answer is not", async () => {
  const { client } = await hotelAs("consent-log")
  const guest = await client.guests.create(newGuest)
  expect(guest.consents).toEqual({ email: true, whatsapp: true, profile: false })

  await client.guests.setConsent({ guestId: guest.id, channel: "whatsapp", granted: true, source: "staff" })
  const withdrawn = await client.guests.setConsent({
    guestId: guest.id,
    channel: "whatsapp",
    granted: false,
    source: "stop_reply",
  })
  expect(withdrawn.consents.whatsapp).toBe(false)

  const events = await client.guests.consentHistory({ id: guest.id })
  const whatsapp = events.filter((event) => event.channel === "whatsapp")
  expect(whatsapp.map((event) => [event.granted, event.source])).toEqual([
    [false, "stop_reply"],
    [true, "qr_room"],
  ])
  expect(events.every((event) => event.wordingVersion === CONSENT_WORDING_VERSION)).toBe(true)
  expect(events.some((event) => event.channel === "profile" && !event.granted)).toBe(true)
})

test("tiers: extra details need the profile consent and go away with it", async () => {
  const { client } = await hotelAs("tiers")
  await expect(client.guests.create({ ...newGuest, city: "Lyon" })).rejects.toThrow()
  await expect(client.guests.create({ ...newGuest, email: null })).rejects.toThrow()

  const guest = await client.guests.create({
    ...newGuest,
    consents: { ...newGuest.consents, profile: true },
    country: "fr",
    city: "Lyon",
  })
  expect(guest).toMatchObject({ country: "FR", city: "Lyon" })

  const cleared = await client.guests.setConsent({
    guestId: guest.id,
    channel: "profile",
    granted: false,
    source: "guest_request",
  })
  expect(cleared).toMatchObject({ country: null, city: null })
  await expect(client.guests.update({ id: guest.id, city: "Paris" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
})

test("one phone is one guest per hotel, and the same phone can be a guest of another hotel", async () => {
  const one = await hotelAs("phone-one")
  const two = await hotelAs("phone-two")
  await one.client.guests.create(newGuest)
  await expect(one.client.guests.create(newGuest)).rejects.toMatchObject({ code: "CONFLICT" })
  await expect(two.client.guests.create(newGuest)).resolves.toMatchObject({ phoneE164: "+21620123456" })
  expect((await one.client.guests.list({})).total).toBe(1)
})

test("the database refuses a consent event that points at another hotel's guest", async () => {
  const one = await hotelAs("fk-one")
  const two = await hotelAs("fk-two")
  const guest = await one.client.guests.create(newGuest)
  await expect(
    (async () =>
      app.services.db.insert(consentEvents).values({
        guestId: guest.id,
        hotelId: two.hotelId,
        channel: "email",
        granted: true,
        source: "staff",
        wordingVersion: CONSENT_WORDING_VERSION,
      }))(),
  ).rejects.toThrow()
})
