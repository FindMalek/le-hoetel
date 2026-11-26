import { afterAll, beforeAll, expect, spyOn, test } from "bun:test"
import { CONSENT_WORDING_VERSION } from "@ritorno/common/consent"
import { parseSpots, QR_LOGO_RATIO } from "@ritorno/common/qr"
import { guests, hotelSettings } from "@ritorno/db"
import { logger } from "@ritorno/logger"
import { eq } from "drizzle-orm"
import jsQR from "jsqr"
import sharp from "sharp"
import { RATE_LIMITS } from "../../lib/rate-limit"
import { createTestApp, type TestApp } from "../../testing"

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
  const owner = await app.signUp("capture-owner@ritorno.test")
  const hotelId = await app.createHotel("capture-hotel", owner)
  const other = await app.createHotel("capture-other", await app.signUp("capture-other@ritorno.test"))
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

test("scanning again with empty toggles keeps the guest's consents and extras", async () => {
  const owner = await app.signUp("capture-rescan@ritorno.test")
  const hotelId = await app.createHotel("capture-rescan", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  await app.anonymous.public.capture({ slug: "capture-rescan", ...scan })
  const id = (await client.guests.list({})).items[0]!.id
  await client.guests.setConsent({ guestId: id, channel: "profile", granted: true, source: "staff" })
  await client.guests.update({ id, city: "Lyon" })
  const before = await client.guests.consentHistory({ id })

  await app.anonymous.public.capture({ slug: "capture-rescan", ...scan, consents: { email: false, whatsapp: false } })

  expect(await client.guests.get({ id })).toMatchObject({ city: "Lyon", consents: { whatsapp: true, profile: true } })
  expect(await client.guests.consentHistory({ id })).toHaveLength(before.length)
})

test("the public hotel only shows branding, an unknown slug is not found, email consent needs an email", async () => {
  const owner = await app.signUp("capture-brand@ritorno.test")
  await app.createHotel("capture-brand", owner)

  expect(Object.keys(await app.anonymous.public.hotel({ slug: "capture-brand" })).sort()).toEqual([
    "accentColor",
    "defaultLanguage",
    "displayName",
    "logoUrl",
    "primaryColor",
    "slug",
    "welcomeOffer",
  ])
  await expect(app.anonymous.public.hotel({ slug: "capture-brand" })).resolves.toMatchObject({ logoUrl: null })
  await app.services.db.update(hotelSettings).set({ logoKey: "pr-1/hotels/h/public/logo.png" })
  await expect(app.anonymous.public.hotel({ slug: "capture-brand" })).resolves.toMatchObject({
    logoUrl: "http://localhost:3001/files/pr-1/hotels/h/public/logo.png",
  })
  await expect(app.anonymous.public.hotel({ slug: "nope" })).rejects.toThrow("Hotel not found.")
  await expect(
    app.anonymous.public.capture({ slug: "capture-brand", ...scan, consents: { email: true, whatsapp: false } }),
  ).rejects.toThrow("Email consent needs an email.")
})

test("a guest who submits right after the page loads is saved", async () => {
  const owner = await app.signUp("capture-quick@ritorno.test")
  const hotelId = await app.createHotel("capture-quick", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")

  await app.anonymous.public.capture({ slug: "capture-quick", ...scan })

  expect((await client.guests.list({})).total).toBe(1)
})

test("bots are dropped silently and counted without their data: honeypot, a link as a name", async () => {
  const owner = await app.signUp("capture-bots@ritorno.test")
  const hotelId = await app.createHotel("capture-bots", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const bot = app.clientFor(new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": "10.0.0.1" }))
  const info = spyOn(logger, "info")

  for (const patch of [{ website: "https://spam.test" }, { name: "see www.spam.test" }]) {
    expect(await bot.public.capture({ slug: "capture-bots", ...scan, ...patch })).toEqual({ ok: true })
  }

  expect(info.mock.calls).toEqual([
    ["capture discarded", { hotelId, reason: "honeypot" }],
    ["capture discarded", { hotelId, reason: "link-name" }],
  ])
  expect((await client.guests.list({})).total).toBe(0)
  info.mockRestore()
})

test("guests behind one hotel ip can all join, and another hotel on that ip is not blocked", async () => {
  const owner = await app.signUp("capture-wifi@ritorno.test")
  const hotelId = await app.createHotel("capture-wifi", owner)
  await app.createHotel("capture-next-door", await app.signUp("capture-next-door@ritorno.test"))
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const wifi = app.clientFor(new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": "10.0.1.1" }))

  for (let i = 0; i < RATE_LIMITS.captureIp.limit; i++) {
    await wifi.public.capture({ slug: "capture-wifi", ...scan, phone: `+2162012${1000 + i}` })
  }

  expect(RATE_LIMITS.captureIp.limit).toBeGreaterThanOrEqual(50)
  expect((await client.guests.list({})).total).toBe(RATE_LIMITS.captureIp.limit)
  await expect(wifi.public.capture({ slug: "capture-wifi", ...scan })).rejects.toThrow("Too many requests")
  await expect(wifi.public.capture({ slug: "capture-next-door", ...scan })).resolves.toEqual({ ok: true })
})

test("a survey answer is not blocked by sign-ups from the same ip", async () => {
  await app.createHotel("capture-survey", await app.signUp("capture-survey@ritorno.test"))
  const wifi = app.clientFor(new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": "10.0.3.1" }))
  for (let i = 0; i < RATE_LIMITS.captureIp.limit; i++) {
    await wifi.public.capture({ slug: "capture-survey", ...scan, phone: `+2162013${1000 + i}` })
  }

  // a bad link is refused for being a bad link, not for the sign-ups before it
  await expect(wifi.public.survey.submit({ token: "not-a-link".repeat(4), nps: 9 })).rejects.toThrow("not valid")
})

test("capture is limited per hotel whatever the ip", async () => {
  const owner = await app.signUp("capture-limit@ritorno.test")
  const hotelId = await app.createHotel("capture-limit", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const from = (ip: string) => app.clientFor(new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": ip }))

  for (let i = 0; i < RATE_LIMITS.captureHotel.limit; i++) {
    await from(`10.1.${i >> 8}.${i & 255}`).public.capture({
      slug: "capture-limit",
      ...scan,
      phone: `+2162012${1000 + i}`,
    })
  }
  await expect(from("10.2.0.1").public.capture({ slug: "capture-limit", ...scan })).rejects.toThrow("Too many requests")
  expect((await client.guests.list({})).total).toBe(RATE_LIMITS.captureHotel.limit)
})

test("the printed code still decodes to its spot with a solid logo over its middle", async () => {
  const owner = await app.signUp("capture-decode@ritorno.test")
  const hotelId = await app.createHotel("capture-decode", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")

  const [code] = await client.hotel.qrCodes({ source: "room", spots: ["12 A"] })
  const width = 600
  // the worst logo there is: opaque black filling the whole white pad's inside
  const pad = Math.round(width * QR_LOGO_RATIO)
  const square = (size: number, background: string) => ({
    input: { create: { width: size, height: size, channels: 4 as const, background } },
    left: Math.round((width - size) / 2),
    top: Math.round((width - size) / 2),
  })
  const plain = await sharp(Buffer.from(code!.svg), { density: 600 }).resize(width, width).png().toBuffer()
  const { data, info } = await sharp(plain)
    .composite([square(pad, "#ffffff"), square(Math.round(pad * 0.86), "#000000")])
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data
  expect(decoded).toBe(code!.url)
  expect(decoded).toEndWith("/h/capture-decode?src=room&loc=12+A")
})

test("staff save rooms and tables in bulk, once each, and only for their own hotel", async () => {
  const owner = await app.signUp("capture-spots@ritorno.test")
  const staff = await app.signUp("capture-spots-staff@ritorno.test")
  const hotelId = await app.createHotel("capture-spots", owner)
  const { client } = await app.joinHotel(staff, hotelId, "staff")
  const otherOwner = await app.signUp("capture-spots-other@ritorno.test")
  const otherId = await app.createHotel("capture-spots-other", otherOwner)
  const other = (await app.joinHotel(otherOwner, otherId, "owner")).client

  await client.hotel.spots.add({ source: "table", names: parseSpots("1-2").spots })
  await client.hotel.spots.add({ source: "room", names: parseSpots("101-102").spots })
  await other.hotel.spots.add({ source: "room", names: ["101"] })
  await client.hotel.spots.add({ source: "room", names: ["102", "9"] })
  expect((await client.hotel.spots.list()).map((spot) => `${spot.source} ${spot.name}`)).toEqual([
    "room 9",
    "room 101",
    "room 102",
    "table 1",
    "table 2",
  ])

  await client.hotel.spots.remove({ spots: [{ source: "room", name: "101" }] })
  expect(await client.hotel.spots.list()).toHaveLength(4)
  expect(await other.hotel.spots.list()).toEqual([{ source: "room", name: "101" }])
})

test("QR codes carry the hotel slug, source and spot, and the stats count captures per spot", async () => {
  const owner = await app.signUp("capture-qr@ritorno.test")
  const hotelId = await app.createHotel("capture-qr", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")

  const codes = await client.hotel.qrCodes({ source: "room", spots: ["101", "102"] })
  expect(codes.map((code) => code.location)).toEqual(["101", "102"])
  expect(codes[0]?.url).toEndWith("/h/capture-qr?src=room&loc=101")
  expect(codes[0]?.svg).toStartWith("<svg")
  expect((await client.hotel.qrCodes({ source: "desk", spots: [] }))[0]?.url).toEndWith("?src=desk")

  await app.anonymous.public.capture({ slug: "capture-qr", ...scan, source: "room", location: "101" })
  await app.anonymous.public.capture({
    slug: "capture-qr",
    ...scan,
    phone: "21 111 222",
    source: "room",
    location: "101",
  })
  expect(await client.hotel.captureStats()).toEqual([{ source: "qr_room", location: "101", guests: 2 }])
})
