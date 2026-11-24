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

test("one phone is one guest per hotel: a second capture merges, and only a guest can withdraw consent", async () => {
  const one = await hotelAs("phone-one")
  const two = await hotelAs("phone-two")
  const first = await one.client.guests.create({
    ...newGuest,
    phone: "20 123 456",
    email: null,
    consents: { email: false, whatsapp: true, profile: false },
  })
  expect(first).toMatchObject({ merged: false, phoneE164: "+21620123456" })

  const again = await one.client.guests.create({
    ...newGuest,
    name: "Someone else",
    phone: "0021620123456",
    source: "csv",
    consents: { email: true, whatsapp: false, profile: false },
  })
  expect(again).toMatchObject({
    id: first.id,
    merged: true,
    name: "Amel Ben Salah",
    email: "amel@example.test",
    consents: { email: true, whatsapp: true },
  })

  const rescan = await one.client.guests.create({
    ...newGuest,
    phone: "+216 20 123 456",
    consents: { email: true, whatsapp: false, profile: false },
  })
  expect(rescan.consents.whatsapp).toBe(false)
  const events = await one.client.guests.consentHistory({ id: first.id })
  expect(events.filter((event) => event.channel === "whatsapp").map((event) => event.granted)).toEqual([false, true])

  await expect(two.client.guests.create(newGuest)).resolves.toMatchObject({ merged: false })
  expect((await one.client.guests.list({})).total).toBe(1)
})

test("a landline can't be asked for WhatsApp consent", async () => {
  const { client } = await hotelAs("landline")
  await expect(client.guests.create({ ...newGuest, phone: "71 123 456" })).rejects.toThrow()
  await expect(
    client.guests.create({
      ...newGuest,
      phone: "71 123 456",
      consents: { email: true, whatsapp: false, profile: false },
    }),
  ).resolves.toMatchObject({ phoneE164: "+21671123456" })
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
