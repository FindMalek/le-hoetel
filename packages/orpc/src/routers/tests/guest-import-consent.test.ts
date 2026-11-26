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
    rows: [{ line: 2, name: "Amel", phone: "20 444 444", consent: "yes" }],
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
