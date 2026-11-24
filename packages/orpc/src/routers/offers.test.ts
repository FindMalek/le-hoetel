import { afterAll, beforeAll, expect, test } from "bun:test"
import { signOfferToken } from "@le-hoetel/common/offer-tokens"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const secret = () => app.services.config.tokenSecret

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
