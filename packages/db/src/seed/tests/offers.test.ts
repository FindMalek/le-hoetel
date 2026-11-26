import { expect, test } from "bun:test"
import { buildHotelScenario } from "../hotels"
import { buildOfferScenario, OFFERS_PER_HOTEL } from "../offers"

const now = new Date("2026-11-24T10:00:00Z")
const hotels = buildHotelScenario(now, "hash")
const s = buildOfferScenario(now, hotels)

test("every hotel has open and closed offers, redeemed once per guest and within the limit", () => {
  expect(s.offers.length).toBe(hotels.organizations.length * OFFERS_PER_HOTEL)
  expect(s.offers.some((o) => o.validUntil && o.validUntil < now)).toBe(true)
  expect(new Set(s.offerRedemptions.map((r) => `${r.offerId}${r.guestId}`)).size).toBe(s.offerRedemptions.length)
  for (const offer of s.offers.filter((o) => o.maxRedemptions)) {
    expect(s.offerRedemptions.filter((r) => r.offerId === offer.id).length).toBeLessThanOrEqual(offer.maxRedemptions!)
  }
  expect(new Set(s.offerCodes.map((c) => c.code)).size).toBe(s.offerCodes.length)
})
