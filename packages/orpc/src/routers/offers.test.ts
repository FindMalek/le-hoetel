import { afterAll, beforeAll, expect, test } from "bun:test"
import { signOfferToken } from "@le-hoetel/common/offer-tokens"
import { auditLog, offerRedemptions } from "@le-hoetel/db"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const secret = () => app.services.config.tokenSecret
const auditActions = () =>
  app.services.db
    .select({ action: auditLog.action })
    .from(auditLog)
    .then((rows) => rows.map((row) => row.action))

async function hotelAs(slug: string) {
  const owner = await app.signUp(`${slug}@le-hoetel.test`)
  const hotelId = await app.createHotel(slug, owner)
  return { hotelId, ...(await app.joinHotel(owner, hotelId, "owner")) }
}

const guest = (phone: string) =>
  ({
    name: "Amel Ben Salah",
    phone,
    language: "fr",
    email: "amel@example.test",
    source: "qr_room",
    consents: { email: true, whatsapp: true, profile: false },
  }) as const

test("offers are per hotel: the promo code is unique inside one hotel only, and another hotel can't touch it", async () => {
  const a = await hotelAs("offers-a")
  const b = await hotelAs("offers-b")
  const offer = await a.client.offers.create({ title: "Free coffee", promoCode: "coffee10" })
  expect(offer.promoCode).toBe("COFFEE10")

  await expect(a.client.offers.create({ title: "Again", promoCode: "COFFEE10" })).rejects.toThrow("already used")
  await b.client.offers.create({ title: "Their coffee", promoCode: "COFFEE10" })

  expect(await b.client.offers.list().then((rows) => rows.map((row) => row.title))).toEqual(["Their coffee"])
  await expect(b.client.offers.update({ id: offer.id, title: "Mine now" })).rejects.toThrow("not found")
  await expect(b.client.offers.delete({ id: offer.id })).rejects.toThrow("not found")
})

test("a guest link opens the offer with one stable code and a QR, a forged link opens nothing", async () => {
  const hotel = await hotelAs("offers-page")
  const offer = await hotel.client.offers.create({ title: "Welcome drink", promoCode: "WELCOME" })
  const amel = await hotel.client.guests.create(guest("+21620333333"))
  const token = signOfferToken(secret(), { hotelId: hotel.hotelId, offerId: offer.id, guestId: amel.id })

  const page = await app.anonymous.public.offer({ token })
  expect(page).toMatchObject({ state: "ready", offer: { title: "Welcome drink" }, language: "fr" })
  expect(page.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  expect(page.qrSvg).toContain("<svg")
  expect((await app.anonymous.public.offer({ token })).code).toBe(page.code)

  await app.services.db.insert(offerRedemptions).values({ offerId: offer.id, hotelId: hotel.hotelId, guestId: amel.id })
  expect((await app.anonymous.public.offer({ token })).state).toBe("redeemed")
  expect(await hotel.client.offers.list().then((rows) => rows[0]?.redeemed)).toBe(1)
  expect(JSON.stringify(page)).not.toContain("Amel")

  const forged = signOfferToken("another-secret-another-secret-123", {
    hotelId: hotel.hotelId,
    offerId: offer.id,
    guestId: amel.id,
  })
  await expect(app.anonymous.public.offer({ token: forged })).rejects.toThrow("not valid")
})

test("the capture page shows only the open welcome offer's title and text", async () => {
  const hotel = await hotelAs("offers-welcome")
  const publicOffer = () => app.anonymous.public.hotel({ slug: "offers-welcome" }).then((h) => h.welcomeOffer)
  expect(await publicOffer()).toBeNull()

  const offer = await hotel.client.offers.create({
    title: "Welcome drink",
    text: "At the bar",
    promoCode: "WELCOME",
    trigger: "welcome",
  })
  expect(await publicOffer()).toEqual({ title: "Welcome drink", text: "At the bar" })

  await hotel.client.offers.update({ id: offer.id, validUntil: new Date(Date.now() - 1000) })
  expect(await publicOffer()).toBeNull()
  await hotel.client.offers.update({ id: offer.id, validUntil: null, active: false })
  expect(await publicOffer()).toBeNull()
})

async function guestCodeFor(hotel: Awaited<ReturnType<typeof hotelAs>>, offerId: string, phone: string) {
  const person = await hotel.client.guests.create(guest(phone))
  const token = signOfferToken(secret(), { hotelId: hotel.hotelId, offerId, guestId: person.id })
  return (await app.anonymous.public.offer({ token })).code
}

test("redeeming: another hotel's code is refused without a leak, the right hotel redeems once even when two scan at the same time", async () => {
  const a = await hotelAs("redeem-a")
  const b = await hotelAs("redeem-b")
  const offer = await a.client.offers.create({ title: "Welcome drink", promoCode: "DRINK" })
  const code = await guestCodeFor(a, offer.id, "+21620444444")

  const foreign = await b.client.offers.redeem({ code })
  expect(foreign).toMatchObject({ status: "wrongHotel", offer: null, guestFirstName: null })
  expect(await b.client.offers.lookup({ code: "DRINK" })).toMatchObject({ status: "unknown", offer: null })

  const looked = await a.client.offers.lookup({ code: code.toLowerCase().replace("-", " ") })
  expect(looked).toMatchObject({ status: "ready", guestFirstName: "Amel", offer: { title: "Welcome drink" } })

  const results = await Promise.all([a.client.offers.redeem({ code }), a.client.offers.redeem({ code })])
  expect(results.map((r) => r.status)).toEqual(["redeemed", "redeemed"])
  expect(results.filter((r) => r.justNow)).toHaveLength(1)
  expect(results.every((r) => r.redeemed?.by)).toBe(true)

  const stats = await a.client.offers.redemptionStats()
  expect(stats).toMatchObject({ today: 1, week: 1, total: 1 })
  expect(stats.recent[0]).toMatchObject({ offerTitle: "Welcome drink", guestFirstName: "Amel" })
  expect((await b.client.offers.redemptionStats()).total).toBe(0)
  expect(await a.client.offers.list().then((rows) => rows[0]?.redeemed)).toBe(1)
  expect((await auditActions()).filter((action) => action === "offer.redeem")).toHaveLength(1)
})

test("the database itself refuses a second redemption of one offer by one guest", async () => {
  const hotel = await hotelAs("redeem-unique")
  const offer = await hotel.client.offers.create({ title: "Dessert", promoCode: "DESSERT" })
  const person = await hotel.client.guests.create(guest("+21620555555"))
  const row = { offerId: offer.id, hotelId: hotel.hotelId, guestId: person.id }
  await app.services.db.insert(offerRedemptions).values(row)
  await expect(Promise.resolve(app.services.db.insert(offerRedemptions).values(row))).rejects.toThrow()
})

test("redeeming: expired, paused and used up offers say why, and staff can redeem but not edit", async () => {
  const hotel = await hotelAs("redeem-states")
  const expired = await hotel.client.offers.create({
    title: "Old",
    promoCode: "OLD",
    validFrom: new Date(Date.now() - 3 * 864e5),
    validUntil: new Date(Date.now() - 864e5),
  })
  const expiredCode = await guestCodeFor(hotel, expired.id, "+21620666666")
  expect(await hotel.client.offers.redeem({ code: expiredCode })).toMatchObject({ status: "expired" })
  expect((await hotel.client.offers.redemptionStats()).total).toBe(0)

  const limited = await hotel.client.offers.create({ title: "Two only", promoCode: "TWO", maxRedemptions: 2 })
  const statuses = []
  for (let i = 0; i < 3; i++) statuses.push((await hotel.client.offers.redeem({ code: "two" })).status)
  expect(statuses).toEqual(["redeemed", "redeemed", "exhausted"])
  expect(await hotel.client.offers.lookup({ code: "TWO" })).toMatchObject({ guestFirstName: null })

  await hotel.client.offers.update({ id: limited.id, active: false })
  expect(await hotel.client.offers.lookup({ code: "TWO" })).toMatchObject({ status: "inactive" })

  const staff = await app.signUp("redeem-states-staff@le-hoetel.test")
  const member = await app.joinHotel(staff, hotel.hotelId, "staff")
  expect(await member.client.offers.lookup({ code: "OLD" })).toMatchObject({ status: "expired" })
  await expect(member.client.offers.create({ title: "No", promoCode: "NOPE" })).rejects.toThrow()
})
