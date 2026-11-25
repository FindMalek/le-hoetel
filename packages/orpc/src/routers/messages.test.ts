import { afterAll, beforeAll, expect, test } from "bun:test"
import { guestConsents, hotelSettings, messages } from "@le-hoetel/db"
import type { SendEmailInput } from "@le-hoetel/notification"
import { and, eq } from "drizzle-orm"
import { applyDeliveryUpdate, applyResendEvent, sendToGuest } from "../lib/messages"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const sent: SendEmailInput[] = []
const notification = {
  live: false,
  channels: [],
  sendEmail: async (input: SendEmailInput) => {
    sent.push(input)
    return { channel: "email", sent: false }
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
    props: {},
  })

  expect(outcome.status).toBe("skipped_no_consent")
  expect(sent).toHaveLength(0)
  const { items } = await client.messages.list({})
  expect(items).toMatchObject([{ status: "skipped_no_consent", channel: "whatsapp", templateKey: "welcome" }])
})

test("an email goes out branded, with one unsubscribe link and the list headers, and is logged without body or recipient", async () => {
  const { hotelId, guestId, client } = await hotelWithGuest("msg-consent", { email: true, whatsapp: true })
  await app.services.db
    .update(hotelSettings)
    .set({ displayName: "Dar Amel", replyToEmail: "front-desk@dar-amel.test" })
    .where(eq(hotelSettings.organizationId, hotelId))
  sent.length = 0

  const outcome = await sendToGuest(ctx(), {
    hotelId,
    guestId,
    channel: "email",
    template: "welcome",
    props: {},
  })

  expect(outcome.status).toBe("sent")
  const [mail] = sent
  expect(mail).toMatchObject({ to: "amel@example.test", fromName: "Dar Amel", replyTo: "front-desk@dar-amel.test" })
  expect(mail?.headers?.["List-Unsubscribe"]).toMatch(/^<http:\/\/localhost:3001\/unsubscribe\/.+>$/)
  expect(mail?.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
  expect(mail?.email.html.match(/localhost:3000\/fr\/u\//g)).toHaveLength(1)
  expect(mail?.email.text.match(/localhost:3000\/fr\/u\//g)).toHaveLength(1)
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

test("a bounce fails the message and a complaint withdraws email consent", async () => {
  const { hotelId, guestId } = await hotelWithGuest("msg-complaint", { email: true, whatsapp: true })
  const values = { hotelId, guestId, channel: "email", templateKey: "welcome", language: "fr", status: "sent" } as const
  await app.services.db.insert(messages).values([
    { ...values, providerId: "re_bounce" },
    { ...values, providerId: "re_spam" },
  ])

  expect(await applyResendEvent(app.services.db, { type: "email.bounced", data: { email_id: "re_bounce" } })).toBe(true)
  const [bounced] = await app.services.db.select().from(messages).where(eq(messages.providerId, "re_bounce"))
  expect(bounced).toMatchObject({ status: "failed", errorCode: "bounced" })
  const consent = () =>
    app.services.db
      .select({ granted: guestConsents.granted })
      .from(guestConsents)
      .where(and(eq(guestConsents.guestId, guestId), eq(guestConsents.channel, "email")))
  expect(await consent()).toEqual([{ granted: true }])

  expect(await applyResendEvent(app.services.db, { type: "email.complained", data: { email_id: "re_spam" } })).toBe(
    true,
  )
  expect(await consent()).toEqual([{ granted: false }])
  const [whatsapp] = await app.services.db
    .select({ granted: guestConsents.granted })
    .from(guestConsents)
    .where(and(eq(guestConsents.guestId, guestId), eq(guestConsents.channel, "whatsapp")))
  expect(whatsapp?.granted).toBe(true)
})
