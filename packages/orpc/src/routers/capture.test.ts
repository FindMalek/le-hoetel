import { afterAll, beforeAll, expect, test } from "bun:test"
import { CONSENT_WORDING_VERSION } from "@le-hoetel/common/consent"
import { guests } from "@le-hoetel/db"
import { eq } from "drizzle-orm"
import { RATE_LIMITS } from "../lib/rate-limit"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const anHourAgo = () => Date.now() - 3_600_000
const scan = {
  renderedAt: anHourAgo(),
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
    "logoUrl",
    "primaryColor",
    "slug",
  ])
  await expect(app.anonymous.public.hotel({ slug: "nope" })).rejects.toThrow("Hotel not found.")
  await expect(
    app.anonymous.public.capture({ slug: "capture-brand", ...scan, consents: { email: true, whatsapp: false } }),
  ).rejects.toThrow("Email consent needs an email.")
})

test("bots are dropped silently: honeypot, a form sent too fast, a link as a name", async () => {
  const owner = await app.signUp("capture-bots@le-hoetel.test")
  const hotelId = await app.createHotel("capture-bots", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const bot = app.clientFor(new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": "10.0.0.1" }))

  for (const patch of [{ website: "https://spam.test" }, { renderedAt: Date.now() }, { name: "see www.spam.test" }]) {
    expect(await bot.public.capture({ slug: "capture-bots", ...scan, ...patch })).toEqual({ ok: true })
  }
  expect((await client.guests.list({})).total).toBe(0)
})

test("capture is limited per ip and per hotel", async () => {
  const owner = await app.signUp("capture-limit@le-hoetel.test")
  const hotelId = await app.createHotel("capture-limit", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const from = (ip: string) => app.clientFor(new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": ip }))

  const one = from("10.0.1.1")
  for (let i = 0; i < RATE_LIMITS.captureIp.limit; i++) {
    await one.public.capture({ slug: "capture-limit", ...scan, phone: `+2162012${1000 + i}` })
  }
  await expect(one.public.capture({ slug: "capture-limit", ...scan })).rejects.toThrow("Too many requests")

  for (let i = RATE_LIMITS.captureIp.limit; i < RATE_LIMITS.captureHotel.limit; i++) {
    await from(`10.1.${i >> 8}.${i & 255}`).public.capture({
      slug: "capture-limit",
      ...scan,
      phone: `+2162012${1000 + i}`,
    })
  }
  await expect(from("10.2.0.1").public.capture({ slug: "capture-limit", ...scan })).rejects.toThrow("Too many requests")
  expect((await client.guests.list({})).total).toBe(RATE_LIMITS.captureHotel.limit)
})
