import { afterAll, beforeAll, expect, test } from "bun:test"
import { CONSENT_WORDING_VERSION } from "@le-hoetel/common/consent"
import { guests } from "@le-hoetel/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const scan = {
  name: "Amel Ben Salah",
  phone: "20 123 456",
  language: "ar",
  source: "table",
  location: "T7",
  consents: { email: false, whatsapp: true },
} as const

test("a guest scanning a QR code lands in that hotel only, with source, spot and logged consents", async () => {
  const owner = await app.signUp("capture-owner@le-hoetel.test")
  const hotelId = await app.createHotel("capture-hotel", owner)
  const other = await app.createHotel("capture-other", await app.signUp("capture-other@le-hoetel.test"))
  const { client } = await app.joinHotel(owner, hotelId, "owner")

  await app.anonymous.public.capture({ slug: "capture-hotel", ...scan })

  const [guest] = await client.guests.list({}).then((list) => list.items)
  expect(guest).toMatchObject({
    phoneE164: "+21620123456",
    source: "qr_table",
    consents: { whatsapp: true, email: false },
  })
  const [row] = await app.services.db.select().from(guests).where(eq(guests.hotelId, hotelId))
  expect(row?.captureLocation).toBe("T7")
  expect(await app.services.db.select().from(guests).where(eq(guests.hotelId, other))).toHaveLength(0)
  const events = await client.guests.consentHistory({ id: guest!.id })
  expect(events.every((event) => event.source === "qr_table" && event.wordingVersion === CONSENT_WORDING_VERSION)).toBe(
    true,
  )
})

test("the public hotel only shows branding, an unknown slug is not found, email consent needs an email", async () => {
  const owner = await app.signUp("capture-brand@le-hoetel.test")
  await app.createHotel("capture-brand", owner)

  expect(Object.keys(await app.anonymous.public.hotel({ slug: "capture-brand" })).sort()).toEqual([
    "accentColor",
    "defaultLanguage",
    "displayName",
    "primaryColor",
    "slug",
  ])
  await expect(app.anonymous.public.hotel({ slug: "nope" })).rejects.toThrow("Hotel not found.")
  await expect(
    app.anonymous.public.capture({ slug: "capture-brand", ...scan, consents: { email: true, whatsapp: false } }),
  ).rejects.toThrow("Email consent needs an email.")
})
