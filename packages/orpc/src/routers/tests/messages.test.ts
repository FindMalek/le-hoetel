import { afterAll, beforeAll, expect, test } from "bun:test"
import { guestConsents, hotelSettings, messages } from "@ritorno/db"
import type { SendEmailInput, SendWhatsAppInput } from "@ritorno/notification"
import { and, eq, inArray } from "drizzle-orm"
import { getBalance, topUp } from "../../lib/balance"
import { applyDeliveryUpdate, applyKapsoEvent, applyResendEvent, sendToGuest } from "../../lib/messages"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const sent: SendEmailInput[] = []
const sentWhatsApp: SendWhatsAppInput[] = []
const notification = {
  live: false,
  channels: [],
  sendEmail: async (input: SendEmailInput) => {
    sent.push(input)
    return { channel: "email", sent: false }
  },
  sendWhatsApp: async (input: SendWhatsAppInput) => {
    sentWhatsApp.push(input)
    return { channel: "whatsapp", sent: true, id: "wamid.sent" }
  },
}
const ctx = () => ({ ...app.services, notification: notification as unknown as typeof app.services.notification })

async function hotelWithGuest(slug: string, consents: { email: boolean; whatsapp: boolean }) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
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

test("a failed WhatsApp webhook gives the debit back once, redelivery included", async () => {
  const { hotelId, guestId } = await hotelWithGuest("msg-failed-refund", { email: false, whatsapp: true })
  await topUp(app.services.db, hotelId, 1000)
  await sendToGuest(ctx(), { hotelId, guestId, channel: "whatsapp", template: "welcome", props: {} })
  expect(await getBalance(app.services.db, hotelId)).toBeLessThan(1000)

  const statuses = [{ status: "failed", errors: [{ code: 131042 }] }]
  const payload = { message: { id: "wamid.sent", kapso: { direction: "outbound", statuses } } }
  const deliver = () => applyKapsoEvent(app.services.db, "whatsapp.message.failed", payload)
  await Promise.all([deliver(), deliver()])
  await deliver()

  expect(await getBalance(app.services.db, hotelId)).toBe(1000)
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

test("whatsapp sends the hotel's named template in the guest's language, and a missing link fails the message", async () => {
  const { hotelId, guestId } = await hotelWithGuest("msg-whatsapp", { email: false, whatsapp: true })
  await app.services.db
    .update(hotelSettings)
    .set({ displayName: "Dar Amel" })
    .where(eq(hotelSettings.organizationId, hotelId))
  await topUp(app.services.db, hotelId, 1000)
  const base = { hotelId, guestId, channel: "whatsapp" } as const
  sentWhatsApp.length = 0

  const ok = await sendToGuest(ctx(), {
    ...base,
    template: "survey",
    props: { ctaUrl: "https://ritorno.test/s/abc" },
  })
  expect(ok.status).toBe("sent")
  expect(sentWhatsApp).toEqual([
    {
      to: "+21620222222",
      template: "guest_survey",
      language: "fr",
      params: { guest_name: "Amel Ben Salah", hotel_name: "Dar Amel", link: "https://ritorno.test/s/abc" },
    },
  ])
  const [row] = await app.services.db.select().from(messages).where(eq(messages.id, ok.messageId))
  expect(row).toMatchObject({ providerId: "wamid.sent" })

  const bad = await sendToGuest(ctx(), { ...base, template: "survey", props: {} as { ctaUrl: string } })
  expect(bad.status).toBe("failed")
  const [failed] = await app.services.db.select().from(messages).where(eq(messages.id, bad.messageId))
  expect(failed).toMatchObject({ errorCode: "missing_link" })
  expect(sentWhatsApp).toHaveLength(1)
})

test("kapso status events move a whatsapp message and a failure keeps the numeric code", async () => {
  const { hotelId, guestId } = await hotelWithGuest("msg-kapso", { email: true, whatsapp: true })
  const values = {
    hotelId,
    guestId,
    channel: "whatsapp",
    templateKey: "welcome",
    language: "fr",
    status: "sent",
  } as const
  await app.services.db.insert(messages).values([
    { ...values, providerId: "wamid.ok" },
    { ...values, providerId: "wamid.bad" },
  ])
  const payload = (id: string, extra = {}) => ({ message: { id, kapso: { direction: "outbound", ...extra } } })

  expect(await applyKapsoEvent(app.services.db, "whatsapp.message.delivered", payload("wamid.ok"))).toBe(true)
  expect(await applyKapsoEvent(app.services.db, "whatsapp.message.received", payload("wamid.ok"))).toBe(false)
  const failure = { statuses: [{ status: "failed", errors: [{ code: 131026, message: "Undeliverable" }] }] }
  expect(await applyKapsoEvent(app.services.db, "whatsapp.message.failed", payload("wamid.bad", failure))).toBe(true)

  const rows = await app.services.db
    .select()
    .from(messages)
    .where(inArray(messages.providerId, ["wamid.ok", "wamid.bad"]))
  expect(rows.find((row) => row.providerId === "wamid.ok")).toMatchObject({ status: "delivered" })
  expect(rows.find((row) => row.providerId === "wamid.bad")).toMatchObject({ status: "failed", errorCode: "131026" })
})

test("the log filters by channel, template and period, pages with a total, and stays in its hotel", async () => {
  const { hotelId, guestId, client } = await hotelWithGuest("msg-filters", { email: true, whatsapp: true })
  const other = await hotelWithGuest("msg-filters-other", { email: true, whatsapp: true })
  const now = Date.now()
  const row = (channel: "email" | "whatsapp", templateKey: string, daysAgo: number) => ({
    hotelId,
    guestId,
    channel,
    templateKey,
    language: "fr" as const,
    status: "sent" as const,
    createdAt: new Date(now - daysAgo * 86_400_000),
  })
  await app.services.db
    .insert(messages)
    .values([
      row("email", "welcome", 1),
      row("whatsapp", "welcome", 2),
      row("whatsapp", "birthday", 3),
      row("whatsapp", "welcome", 40),
      { ...row("whatsapp", "welcome", 1), hotelId: other.hotelId, guestId: other.guestId },
    ])

  const recent = await client.messages.list({ channel: "whatsapp", template: "welcome", days: 30 })
  expect(recent.total).toBe(1)
  expect(recent.items).toMatchObject([{ channel: "whatsapp", templateKey: "welcome" }])

  const first = await client.messages.list({ limit: 3 })
  const second = await client.messages.list({ limit: 3, cursor: first.nextCursor! })
  expect(second).toMatchObject({ total: 4, nextCursor: null })
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(4)
})

test("only a message that was not sent keeps its text, readable in its own hotel", async () => {
  const { hotelId, guestId, client } = await hotelWithGuest("msg-preview", { email: true, whatsapp: true })
  await topUp(app.services.db, hotelId, 1000)
  const base = { hotelId, guestId, template: "welcome", props: {} } as const
  const logOnly = {
    live: false,
    sendEmail: async () => ({ channel: "email", sent: false }),
    sendWhatsApp: async () => ({ channel: "whatsapp", sent: false }),
  } as unknown as typeof app.services.notification

  const email = await sendToGuest({ ...app.services, notification: logOnly }, { ...base, channel: "email" })
  const chat = await sendToGuest({ ...app.services, notification: logOnly }, { ...base, channel: "whatsapp" })
  // The shared double answers WhatsApp as really sent.
  const real = await sendToGuest(ctx(), { ...base, channel: "whatsapp" })

  const { items } = await client.messages.list({})
  expect(Object.fromEntries(items.map((item) => [item.id, item.notSent]))).toEqual({
    [email.messageId]: true,
    [chat.messageId]: true,
    [real.messageId]: false,
  })
  const mail = await client.messages.preview({ id: email.messageId })
  expect("html" in mail && mail.html).toContain("Amel Ben Salah")
  const text = await client.messages.preview({ id: chat.messageId })
  expect("text" in text && text.text).toMatch(/^Bonjour Amel Ben Salah, bienvenue à .+STOP/s)
  await expect(client.messages.preview({ id: real.messageId })).rejects.toMatchObject({ code: "NOT_FOUND" })
  const other = await hotelWithGuest("msg-preview-other", { email: true, whatsapp: true })
  await expect(other.client.messages.preview({ id: email.messageId })).rejects.toMatchObject({ code: "NOT_FOUND" })
})
