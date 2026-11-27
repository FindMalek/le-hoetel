import { afterAll, beforeAll, expect, test } from "bun:test"
import { auditLog, whatsappScans } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

async function hotel(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const add = (name: string, phone: string) =>
    client.guests.create({
      name,
      phone,
      language: "fr",
      email: `${name.toLowerCase()}@example.com`,
      source: "staff",
      consents: { whatsapp: true, email: true, profile: false },
    })
  return { client, hotelId, add }
}

test("a new phone number turns WhatsApp consent off and leaves a trace without the numbers", async () => {
  const { client, hotelId, add } = await hotel("phone-change")
  const guest = await add("Amel", "20 111 111")
  const at = new Date()
  await app.services.db.insert(whatsappScans).values({
    hotelId,
    phoneE164: guest.phoneE164,
    source: "qr_front_desk",
    language: "fr",
    lastScanAt: at,
    repliedAt: at,
  })

  const same = await client.guests.update({ id: guest.id, phone: "+216 20 111 111" })
  expect(same.consents.whatsapp).toBe(true)

  const changed = await client.guests.update({ id: guest.id, phone: "20 222 222" })
  expect(changed.phoneE164).toBe("+21620222222")
  expect(changed.consents).toMatchObject({ whatsapp: false, email: true })
  const events = await client.guests.consentHistory({ id: guest.id })
  expect(events.filter((e) => e.channel === "whatsapp").map((e) => e.granted)).toEqual([false, true])
  expect(await app.services.db.select().from(whatsappScans)).toEqual([])

  const entries = await app.services.db.select().from(auditLog).where(eq(auditLog.action, "guest.phone-change"))
  expect(entries.map((e) => [e.targetId, e.metadata])).toEqual([[guest.id, { hotelId, whatsappWithdrawn: true }]])
})

test("a number another guest of the hotel has is refused, one from another hotel is not", async () => {
  const here = await hotel("phone-taken")
  const there = await hotel("phone-elsewhere")
  const guest = await here.add("Sami", "20 333 333")
  const other = await here.add("Nour", "20 444 444")
  await there.add("Ines", "20 555 555")

  await expect(here.client.guests.update({ id: guest.id, phone: "20 444 444" })).rejects.toMatchObject({
    code: "CONFLICT",
    data: { guestId: other.id },
  })
  expect((await here.client.guests.get({ id: guest.id })).consents.whatsapp).toBe(true)
  expect((await here.client.guests.update({ id: guest.id, phone: "20 555 555" })).phoneE164).toBe("+21620555555")
})
