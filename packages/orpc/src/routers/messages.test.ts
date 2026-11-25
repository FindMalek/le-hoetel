import { afterAll, beforeAll, expect, test } from "bun:test"
import { messages } from "@le-hoetel/db"
import type { SendInput } from "@le-hoetel/notification"
import { eq } from "drizzle-orm"
import { applyDeliveryUpdate, sendToGuest } from "../lib/messages"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const sent: SendInput[] = []
const notification = {
  live: false,
  channels: [],
  send: async (input: SendInput) => {
    sent.push(input)
    return { channel: input.channel, sent: false }
  },
}
const ctx = () => ({ ...app.services, notification: notification as unknown as typeof app.services.notification })

async function hotelWithGuest(slug: string, consents: { email: boolean; whatsapp: boolean }) {
  const owner = await app.signUp(`${slug}@le-hoetel.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620222222",
    language: "fr",
    email: "amel@example.test",
    source: "qr_room",
    consents: { ...consents, profile: false },
  })
  return { hotelId, guestId: guest.id, client }
}

test("without consent nothing is sent and the row says skipped_no_consent", async () => {
  const { hotelId, guestId, client } = await hotelWithGuest("msg-no-consent", { email: false, whatsapp: false })
  sent.length = 0

  const outcome = await sendToGuest(ctx(), {
    hotelId,
    guestId,
    channel: "whatsapp",
    template: "welcome",
    data: { url: "https://example.test" },
  })

  expect(outcome.status).toBe("skipped_no_consent")
  expect(sent).toHaveLength(0)
  const { items } = await client.messages.list({})
  expect(items).toMatchObject([{ status: "skipped_no_consent", channel: "whatsapp", templateKey: "welcome" }])
})

test("with consent the message ends with the unsubscribe line and is logged without body or recipient", async () => {
  const { hotelId, guestId, client } = await hotelWithGuest("msg-consent", { email: true, whatsapp: true })
  sent.length = 0

  const outcome = await sendToGuest(ctx(), {
    hotelId,
    guestId,
    channel: "email",
    template: "welcome",
    data: { url: "https://example.test" },
  })

  expect(outcome.status).toBe("sent")
  expect(sent[0]?.to).toBe("amel@example.test")
  expect(sent[0]?.footer).toContain("http://localhost:3000/fr/u/")
  const [row] = await app.services.db.select().from(messages).where(eq(messages.id, outcome.messageId))
  expect(row).toMatchObject({ status: "sent", providerId: "log-only", language: "fr" })
  expect(JSON.stringify(row)).not.toContain("amel@example.test")

  const other = await hotelWithGuest("msg-other", { email: true, whatsapp: true })
  expect((await other.client.messages.list({})).items).toHaveLength(0)
  expect((await client.messages.list({})).items).toHaveLength(1)
})

test("a status webhook only moves a message forward", async () => {
  const { hotelId, guestId } = await hotelWithGuest("msg-status", { email: true, whatsapp: true })
  const [row] = await app.services.db
    .insert(messages)
    .values({
      hotelId,
      guestId,
      channel: "whatsapp",
      templateKey: "welcome",
      language: "fr",
      status: "sent",
      providerId: "wamid.1",
    })
    .returning()
  const at = new Date()

  expect(await applyDeliveryUpdate(app.services.db, { providerId: "wamid.1", status: "delivered", at })).toHaveLength(1)
  expect(await applyDeliveryUpdate(app.services.db, { providerId: "wamid.1", status: "sent", at })).toHaveLength(0)
  const [after] = await app.services.db.select().from(messages).where(eq(messages.id, row!.id))
  expect(after).toMatchObject({ status: "delivered" })
})
