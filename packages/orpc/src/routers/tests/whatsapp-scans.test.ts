import { afterAll, beforeAll, expect, test } from "bun:test"
import { signScanCode } from "@ritorno/common/whatsapp-scan"
import { consentEvents, guests, hotelSettings, inboxItem, whatsappScans } from "@ritorno/db"
import type { Notifier } from "@ritorno/notification"
import { eq } from "drizzle-orm"
import { handleInboundWhatsApp } from "../../lib/unsubscribe"
import { handleWhatsAppScan } from "../../lib/whatsapp-scans"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const SECRET = "test-secret-test-secret-test-secret!"

async function hotel(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  return { hotelId, client, ownerId: owner.id }
}

/** The services with the WhatsApp provider recorded instead of called. */
function provider() {
  const replies: { to: string; text: string }[] = []
  const notification = {
    replyWhatsApp: async (to: string, text: string) => {
      replies.push({ to, text })
      return { channel: "whatsapp", sent: true }
    },
  } as unknown as Notifier
  return { replies, context: { ...app.services, notification } }
}

const message = (from: string, body: string) => ({ message: { from, type: "text", text: { body } } })

const code = (slug: string, location = "12", language: "en" | "fr" | "ar" = "fr") =>
  signScanCode(SECRET, { slug, source: "room", language, location })

const scansOf = (hotelId: string) =>
  app.services.db.select().from(whatsappScans).where(eq(whatsappScans.hotelId, hotelId))

test("the page link exists only with a business number, and carries a code the webhook accepts", async () => {
  const { hotelId } = await hotel("scan-link")
  const input = { slug: "scan-link", source: "table", language: "ar", location: "T4" } as const
  expect(await app.anonymous.public.whatsappLink(input)).toEqual({ url: null })

  app.services.config.whatsappNumber = "21671000000"
  const { url } = await app.anonymous.public.whatsappLink(input)
  app.services.config.whatsappNumber = undefined
  const link = new URL(url!)
  expect(link.origin + link.pathname).toBe("https://wa.me/21671000000")

  const { context, replies } = provider()
  await handleWhatsAppScan(context, message("21620000001", link.searchParams.get("text")!))
  expect(replies).toHaveLength(1)
  expect(await scansOf(hotelId)).toMatchObject([{ source: "qr_table", location: "T4", language: "ar" }])
})

test("one welcome per day in the code's language, with no guest and no consent created, and staff are told", async () => {
  const { hotelId, client, ownerId } = await hotel("scan-welcome")
  const { context, replies } = provider()
  const inbound = message("21620000002", `Bonjour ! (réf : ${code("scan-welcome")})`)

  expect(await handleWhatsAppScan(context, inbound)).toBe(true)
  expect(await handleWhatsAppScan(context, inbound)).toBe(false)

  expect(replies).toHaveLength(1)
  expect(replies[0]!.to).toBe("+21620000002")
  expect(replies[0]!.text).toContain("Bienvenue à scan-welcome !")
  expect(replies[0]!.text).toContain("/h/scan-welcome?src=room&loc=12&lang=fr")
  expect(replies[0]!.text).toContain("STOP")
  expect(await app.services.db.select().from(guests).where(eq(guests.hotelId, hotelId))).toHaveLength(0)
  expect(await app.services.db.select().from(consentEvents).where(eq(consentEvents.hotelId, hotelId))).toHaveLength(0)
  const notes = await app.services.db.select().from(inboxItem).where(eq(inboxItem.userId, ownerId))
  expect(notes).toMatchObject([{ href: "/whatsapp", body: "Chambre 12" }])
  expect(JSON.stringify(notes)).not.toContain("20000002")
  expect(await client.whatsappScans.list()).toMatchObject([{ phoneE164: "+21620000002", spot: "room", guestId: null }])

  const tomorrow = { ...context, now: () => new Date(Date.now() + 25 * 60 * 60_000) }
  expect(await handleWhatsAppScan(tomorrow, inbound)).toBe(true)
  expect(replies).toHaveLength(2)
})

test("edited or foreign codes and suspended hotels get no reply and store nothing", async () => {
  const { hotelId } = await hotel("scan-closed")
  const { context, replies } = provider()
  const good = code("scan-closed")
  const forged = signScanCode("another-secret-another-secret-xx", {
    slug: "scan-closed",
    source: "room",
    language: "fr",
    location: "12",
  })
  const edited = `${good.slice(0, 5)}${good[5] === "A" ? "B" : "A"}${good.slice(6)}`
  for (const text of [forged, edited, "hello"]) await handleWhatsAppScan(context, message("21620000003", text))

  await app.services.db
    .update(hotelSettings)
    .set({ status: "suspended" })
    .where(eq(hotelSettings.organizationId, hotelId))
  await handleWhatsAppScan(context, message("21620000003", good))

  expect(replies).toHaveLength(0)
  expect(await scansOf(hotelId)).toHaveLength(0)
})

test("one number can't draw more than five replies a day across hotels", async () => {
  const { context, replies } = provider()
  for (let n = 0; n < 7; n++) {
    await hotel(`scan-flood-${n}`)
    await handleWhatsAppScan(context, message("21620000004", code(`scan-flood-${n}`)))
  }
  expect(replies).toHaveLength(5)
})

test("STOP removes the number from the staff list and is confirmed once, even without a guest", async () => {
  const { hotelId } = await hotel("scan-stop")
  const { context, replies } = provider()
  await handleWhatsAppScan(context, message("21620000005", code("scan-stop", "3", "en")))

  expect(await handleInboundWhatsApp(context, message("21620000005", "STOP"))).toBe(true)
  expect(await handleInboundWhatsApp(context, message("21620000005", "STOP"))).toBe(false)

  expect(await scansOf(hotelId)).toHaveLength(0)
  expect(replies).toHaveLength(2)
  expect(replies[1]!.text).toStartWith("You are unsubscribed")
})

test("a scan stays in its hotel and goes out with the guest's export and delete", async () => {
  const a = await hotel("scan-data-a")
  const b = await hotel("scan-data-b")
  const guest = await a.client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620000006",
    language: "fr",
    source: "staff",
    consents: { email: false, whatsapp: false, profile: false },
  })
  const { context, replies } = provider()
  await handleWhatsAppScan(context, message("21620000006", code("scan-data-a")))
  await handleWhatsAppScan(context, message("21620000007", code("scan-data-a")))

  // A signed-up guest gets no sign-up link.
  expect(replies[0]!.text).not.toContain("/h/scan-data-a")
  expect(await b.client.whatsappScans.list()).toEqual([])
  const [first] = await a.client.whatsappScans.list()
  expect(b.client.whatsappScans.remove({ id: first!.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  expect((await a.client.guests.export({ id: guest.id })).whatsappScans).toMatchObject([{ location: "12" }])
  expect((await a.client.guests.exportAll()).whatsappScans).toHaveLength(2)

  await a.client.guests.remove({ id: guest.id })

  expect((await scansOf(a.hotelId)).map((scan) => scan.phoneE164)).toEqual(["+21620000007"])
})
