import { afterAll, beforeAll, expect, test } from "bun:test"
import { CONSENT_WORDING_VERSION } from "@ritorno/common/consent"
import { auditLog, consentEvents } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { hashGuestId } from "../../lib/guests"
import { createTestApp, type TestApp } from "../../testing"

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
  const owner = await app.signUp(`${slug}-owner@ritorno.test`)
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

test("consent: the log names the staff member behind a change, never for the guest's own scan", async () => {
  const owner = await app.signUp("consent-staff@ritorno.test")
  const hotelId = await app.createHotel("consent-staff", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  await app.anonymous.public.capture({
    slug: "consent-staff",
    renderedAt: Date.now() - 3_600_000,
    name: "Amel",
    phone: newGuest.phone,
    language: "fr",
    source: "table",
    consents: { email: false, whatsapp: true },
  })
  const [guest] = (await client.guests.list({})).items
  await client.guests.setConsent({ guestId: guest!.id, channel: "whatsapp", granted: false, source: "staff" })

  const events = await app.services.db.select().from(consentEvents).where(eq(consentEvents.hotelId, hotelId))
  expect(events.filter((e) => e.source === "staff").map((e) => e.staffUserId)).toEqual([owner.id])
  expect(events.filter((e) => e.source === "qr_table").every((e) => e.staffUserId === null)).toBe(true)
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

test("one phone is one guest per hotel: a second capture merges and never withdraws consent", async () => {
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
  expect(rescan.consents.whatsapp).toBe(true)
  const events = await one.client.guests.consentHistory({ id: first.id })
  expect(events.filter((event) => event.channel === "whatsapp").map((event) => event.granted)).toEqual([true])

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

test("list filters by consent, source and language inside one hotel", async () => {
  const { client } = await hotelAs("filters")
  const other = await hotelAs("filters-other")
  const base = { ...newGuest, consents: { email: false, whatsapp: false, profile: false } }
  await client.guests.create({
    ...base,
    name: "Mail",
    phone: "+21620000001",
    consents: { ...base.consents, email: true },
  })
  await client.guests.create({
    ...base,
    name: "Wa",
    phone: "+21620000002",
    consents: { ...base.consents, whatsapp: true },
    language: "ar",
    source: "csv",
  })
  await client.guests.create({ ...base, name: "Silent", phone: "+21620000003", email: null })
  await other.client.guests.create({
    ...base,
    name: "Other hotel",
    phone: "+21620000004",
    consents: { ...base.consents, email: true },
  })

  const names = async (filter: Parameters<typeof client.guests.list>[0]) =>
    (await client.guests.list(filter)).items.map((guest) => guest.name).sort()
  expect(await names({ consent: "email" })).toEqual(["Mail"])
  expect(await names({ consent: "none" })).toEqual(["Silent"])
  expect(await names({ source: "csv" })).toEqual(["Wa"])
  expect(await names({ language: "ar" })).toEqual(["Wa"])
  expect(await names({ consent: "whatsapp", language: "fr" })).toEqual([])
})

test("deleting a guest removes their consent log too and leaves an audit row without personal data", async () => {
  const { client } = await hotelAs("erase")
  const guest = await client.guests.create(newGuest)
  await client.guests.remove({ id: guest.id })

  await expect(client.guests.get({ id: guest.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  const left = await app.services.db.select().from(consentEvents).where(eq(consentEvents.guestId, guest.id))
  expect(left).toEqual([])
  const [entry] = await app.services.db
    .select()
    .from(auditLog)
    .where(eq(auditLog.targetId, hashGuestId(guest.id)))
  expect(entry?.action).toBe("guest.delete")
  expect(JSON.stringify(entry)).not.toContain("20123456")
})

test("import: rows fail one by one, a phone merges, consent needs an explicit yes and the hotel's confirmation", async () => {
  const { client } = await hotelAs("import")
  const staff = await app.signUp("import-staff@ritorno.test")
  const hotel = await client.hotel.get()
  const asStaff = await app.joinHotel(staff, hotel.id, "staff")
  await expect(
    asStaff.client.guests.import({
      rows: [{ line: 2, name: "A", phone: "20 111 111" }],
      defaultLanguage: "fr",
      confirmConsent: true,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" })

  const rows = [
    { line: 2, name: "Yes", phone: "20 111 111", email: "yes@example.test", consent: "oui" },
    { line: 3, name: "Blank", phone: "+216 20 222 222", consent: "" },
    { line: 4, name: "No phone", phone: "abc" },
    { line: 5, name: "Yes again", phone: "20111111", birthday: "31/12/1990" },
    { line: 6, name: "Landline", phone: "71 000 000", consent: "true" },
  ]
  const confirmed = await client.guests.import({ rows, defaultLanguage: "ar", confirmConsent: true })
  expect(confirmed).toMatchObject({ created: 3, merged: 1 })
  expect(confirmed.errors.map((error) => error.line)).toEqual([4])

  const { items } = await client.guests.list({})
  const by = (name: string) => items.find((guest) => guest.name === name)!
  expect(by("Yes")).toMatchObject({ source: "csv", language: "ar", birthday: "1990-12-31" })
  expect(by("Yes").consents).toEqual({ email: true, whatsapp: true, profile: false })
  expect(by("Blank").consents).toEqual({ email: false, whatsapp: false, profile: false })
  expect(by("Landline").consents.whatsapp).toBe(false)

  await client.guests.import({
    rows: [{ line: 2, name: "Other", phone: "20 333 333", consent: "true" }],
    defaultLanguage: "fr",
    confirmConsent: false,
  })
  expect((await client.guests.list({ q: "Other" })).items[0]?.consents).toEqual({
    email: false,
    whatsapp: false,
    profile: false,
  })
})
