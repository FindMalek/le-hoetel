import { afterAll, beforeAll, expect, test } from "bun:test"
import { signUnsubscribeToken } from "@le-hoetel/common/unsubscribe"
import { consentEvents } from "@le-hoetel/db"
import { eq } from "drizzle-orm"
import { applyStopReply } from "../lib/unsubscribe"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const SECRET = "test-secret-test-secret-test-secret!"

async function hotelWithGuest(slug: string, phone: string) {
  const owner = await app.signUp(`${slug}@le-hoetel.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone,
    language: "fr",
    email: "amel@example.test",
    source: "qr_room",
    consents: { email: true, whatsapp: true, profile: false },
  })
  const token = signUnsubscribeToken(SECRET, { hotelId, guestId: guest.id, channel: "email" })
  return { hotelId, guest, token, client }
}

test("unsubscribe all through the link stops both channels and logs one event each with source unsubscribe_link", async () => {
  const { guest, token, client } = await hotelWithGuest("unsub-all", "+21620111111")
  const anon = app.anonymous

  const page = await anon.public.unsubscribe.get({ token })
  expect(page.hotel.displayName).toBeString()
  expect(page.channels).toEqual([
    { channel: "email", granted: true },
    { channel: "whatsapp", granted: true },
  ])
  expect(JSON.stringify(page)).not.toContain("amel@example.test")

  const after = await anon.public.unsubscribe.all({ token })
  expect(after.every((state) => !state.granted)).toBe(true)
  expect((await client.guests.get({ id: guest.id })).consents).toMatchObject({ email: false, whatsapp: false })

  const events = await client.guests.consentHistory({ id: guest.id })
  expect(
    events
      .filter((event) => event.source === "unsubscribe_link")
      .map((event) => event.channel)
      .sort(),
  ).toEqual(["email", "whatsapp"])
  await anon.public.unsubscribe.all({ token })
  expect((await client.guests.consentHistory({ id: guest.id })).length).toBe(events.length)
})

test("one channel can be switched off and on again, the other is untouched", async () => {
  const { token } = await hotelWithGuest("unsub-one", "+21620222222")
  const anon = app.anonymous
  const off = await anon.public.unsubscribe.update({ token, whatsapp: false })
  expect(off).toEqual([
    { channel: "email", granted: true },
    { channel: "whatsapp", granted: false },
  ])
  const on = await anon.public.unsubscribe.update({ token, whatsapp: true })
  expect(on.find((state) => state.channel === "whatsapp")?.granted).toBe(true)
})

test("a forged, foreign or stale token changes nothing", async () => {
  const a = await hotelWithGuest("unsub-a", "+21620333333")
  const b = await hotelWithGuest("unsub-b", "+21620333333")
  const anon = app.anonymous
  const forged = signUnsubscribeToken("another-secret-another-secret-12345", {
    hotelId: a.hotelId,
    guestId: a.guest.id,
    channel: "email",
  })
  await expect(anon.public.unsubscribe.all({ token: forged })).rejects.toThrow()
  const crossed = signUnsubscribeToken(SECRET, { hotelId: b.hotelId, guestId: a.guest.id, channel: "email" })
  await expect(anon.public.unsubscribe.all({ token: crossed })).rejects.toThrow()
  expect((await a.client.guests.get({ id: a.guest.id })).consents.email).toBe(true)
})

test("a STOP reply withdraws whatsapp for that number only, and logs source stop_reply", async () => {
  const a = await hotelWithGuest("stop-a", "+21620444444")
  const other = await hotelWithGuest("stop-other", "+21620555555")
  const changed = await applyStopReply(app.services.db, { phoneE164: "+21620444444", at: new Date() })
  expect(changed).toBe(1)
  expect((await a.client.guests.get({ id: a.guest.id })).consents).toMatchObject({ whatsapp: false, email: true })
  expect((await other.client.guests.get({ id: other.guest.id })).consents.whatsapp).toBe(true)
  const [event] = await app.services.db
    .select()
    .from(consentEvents)
    .where(eq(consentEvents.guestId, a.guest.id))
    .orderBy(consentEvents.at)
    .limit(10)
    .then((rows) => rows.filter((row) => row.source === "stop_reply"))
  expect(event?.channel).toBe("whatsapp")
})
