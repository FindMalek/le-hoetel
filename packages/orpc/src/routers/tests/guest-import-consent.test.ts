import { afterAll, beforeAll, expect, test } from "bun:test"
import { signUnsubscribeToken } from "@ritorno/common/unsubscribe"
import { consentEvents } from "@ritorno/db"
import { and, eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("import after unsubscribe keeps consent withdrawn and logs no new opt-in", async () => {
  const owner = await app.signUp("import-unsub@ritorno.test")
  const hotelId = await app.createHotel("import-unsub", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620444444",
    language: "fr",
    email: "amel@example.test",
    source: "qr_room",
    consents: { email: true, whatsapp: true, profile: false },
  })
  const token = signUnsubscribeToken("test-secret-test-secret-test-secret!", {
    hotelId,
    guestId: guest.id,
    channel: "email",
  })
  await app.anonymous.public.unsubscribe.all({ token })

  const result = await client.guests.import({
    rows: [{ line: 2, name: "Amel", phone: "20 444 444", emailConsent: "yes", whatsappConsent: "yes" }],
    defaultLanguage: "fr",
    confirmConsent: true,
  })

  expect(result).toMatchObject({ merged: 1, consentKept: 1 })
  expect((await client.guests.get({ id: guest.id })).consents).toMatchObject({ email: false, whatsapp: false })
  const optIns = await app.services.db
    .select()
    .from(consentEvents)
    .where(and(eq(consentEvents.guestId, guest.id), eq(consentEvents.granted, true)))
  expect(optIns).toHaveLength(2)
})

test("imported stay dates need their own consent, never rewind and never come back once withdrawn", async () => {
  const owner = await app.signUp("import-stay@ritorno.test")
  const hotelId = await app.createHotel("import-stay", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const importRow = (row: { stayCheckIn: string; stayCheckOut?: string; stayConsent?: string }) =>
    client.guests.import({
      rows: [{ line: 2, name: "Amel", phone: "20 455 455", emailConsent: "yes", whatsappConsent: "yes", ...row }],
      defaultLanguage: "fr",
      confirmConsent: true,
    })
  const stored = async () => (await client.guests.find({ q: "20455455" }).then(([g]) => client.guests.get(g!)))!

  await importRow({ stayCheckIn: "2026-05-01", stayCheckOut: "2026-05-08" })
  expect(await stored()).toMatchObject({ stayCheckIn: null, stayCheckOut: null, consents: { profile: false } })

  await importRow({ stayCheckIn: "01/05/2026", stayCheckOut: "08/05/2026", stayConsent: "yes" })
  await importRow({ stayCheckIn: "2025-01-01", stayCheckOut: "2025-01-05", stayConsent: "yes" })
  expect(await stored()).toMatchObject({ stayCheckIn: "2026-05-01", stayCheckOut: "2026-05-08" })

  const { id } = await stored()
  // a current stay that only has an arrival is newer than the old list too
  await client.guests.update({ id, stayCheckIn: "2026-11-20", stayCheckOut: null })
  await importRow({ stayCheckIn: "2025-01-01", stayCheckOut: "2025-01-05", stayConsent: "yes" })
  expect(await stored()).toMatchObject({ stayCheckIn: "2026-11-20", stayCheckOut: null })
  await client.guests.update({ id, stayCheckIn: "2026-05-01", stayCheckOut: "2026-05-08" })

  await expect(client.guests.update({ id, stayCheckIn: "2026-06-01" })).rejects.toThrow("Departure")

  await client.guests.setConsent({ guestId: id, channel: "profile", granted: false, source: "guest_request" })
  await importRow({ stayCheckIn: "2026-09-01", stayCheckOut: "2026-09-08", stayConsent: "yes" })
  expect(await stored()).toMatchObject({ stayCheckIn: null, stayCheckOut: null, consents: { profile: false } })
})

test("the import check names only this hotel's known numbers", async () => {
  const hotel = async (slug: string) => {
    const owner = await app.signUp(`${slug}@ritorno.test`)
    const hotelId = await app.createHotel(slug, owner)
    return (await app.joinHotel(owner, hotelId, "owner")).client
  }
  const mine = await hotel("import-check")
  const theirs = await hotel("import-check-other")
  const guest = (phone: string) => ({
    name: "Amel",
    phone,
    language: "fr" as const,
    source: "staff" as const,
    consents: { email: false, whatsapp: false, profile: false },
  })
  await mine.guests.create(guest("+21620466466"))
  await theirs.guests.create(guest("+21620477477"))

  expect(await mine.guests.importCheck({ phones: ["+21620466466", "+21620477477"] })).toEqual({
    known: ["+21620466466"],
  })
})
