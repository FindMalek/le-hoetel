import type { offerCodes, offerRedemptions, offers } from "../schema"
import type { HotelScenario } from "./hotels"
import { random } from "./random"

const DAY = 864e5
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

type NewOffer = typeof offers.$inferInsert
type NewCode = typeof offerCodes.$inferInsert
type NewRedemption = typeof offerRedemptions.$inferInsert

export interface OfferScenario {
  offers: NewOffer[]
  offerCodes: NewCode[]
  offerRedemptions: NewRedemption[]
}

interface OfferDef {
  key: string
  title: string
  text: string
  promoCode: string
  trigger: NewOffer["trigger"]
  startedDaysAgo: number
  endsInDays: number | null
  max: number | null
  active: boolean
  /** Share of the hotel's guests who redeemed it, and how many days back the redemptions reach. */
  share: number
  spanDays: number
}

const DEFS: OfferDef[] = [
  {
    key: "welcome",
    title: "Welcome drink",
    text: "A fresh juice or a mint tea at the bar, on us. Show the QR to the bartender.",
    promoCode: "WELCOME",
    trigger: "welcome",
    startedDaysAgo: 100,
    endsInDays: null,
    max: null,
    active: true,
    share: 0.3,
    spanDays: 60,
  },
  {
    key: "birthday",
    title: "Birthday dessert",
    text: "A dessert and a candle at dinner during your birthday week.",
    promoCode: "BIRTHDAY",
    trigger: "birthday",
    startedDaysAgo: 80,
    endsInDays: null,
    max: null,
    active: true,
    share: 0.06,
    spanDays: 70,
  },
  {
    key: "spa",
    title: "Spa credit for a late checkout",
    text: "10 TND off a massage when you leave after noon.",
    promoCode: "SPA10",
    trigger: null,
    startedDaysAgo: 60,
    endsInDays: -15,
    max: 25,
    active: true,
    share: 0.1,
    spanDays: 45,
  },
]

/** Offers per demo hotel, the codes guests hold and who redeemed what: some open, some past their end date or fully used. */
export function buildOfferScenario(now: Date, hotels: HotelScenario, seed = 20261125): OfferScenario {
  const rand = random(seed)
  const int = (max: number) => Math.floor(rand() * max)
  const hex = (n: number) => Array.from({ length: n }, () => int(16).toString(16)).join("")
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[int(4)]}${hex(3)}-${hex(12)}`
  const used = new Set<string>()
  const code = () => {
    let value: string
    do {
      const raw = Array.from({ length: 8 }, () => ALPHABET[int(ALPHABET.length)]).join("")
      value = `${raw.slice(0, 4)}-${raw.slice(4)}`
    } while (used.has(value))
    used.add(value)
    return value
  }

  const out: OfferScenario = { offers: [], offerCodes: [], offerRedemptions: [] }
  for (const hotel of hotels.organizations) {
    const hotelId = hotel.id!
    const ownerId = hotels.members.find((m) => m.organizationId === hotelId)!.userId
    const people = hotels.guests.filter((g) => g.hotelId === hotelId)
    for (const def of DEFS) {
      const offerId = uuid()
      out.offers.push({
        id: offerId,
        hotelId,
        title: def.title,
        text: def.text,
        promoCode: def.promoCode,
        trigger: def.trigger,
        validFrom: new Date(now.getTime() - def.startedDaysAgo * DAY),
        validUntil: def.endsInDays === null ? null : new Date(now.getTime() + def.endsInDays * DAY),
        maxRedemptions: def.max,
        active: def.active,
        createdAt: new Date(now.getTime() - def.startedDaysAgo * DAY),
      })
      const wanted = Math.min(def.max ?? Infinity, Math.round(people.length * def.share))
      const takers = people
        .filter((_, i) => (i * 7919 + def.promoCode.length) % people.length < wanted)
        .slice(0, wanted)
      for (const guest of takers) {
        out.offerCodes.push({ offerId, hotelId, guestId: guest.id!, code: code() })
        out.offerRedemptions.push({
          offerId,
          hotelId,
          guestId: guest.id!,
          redeemedBy: ownerId,
          redeemedAt: new Date(now.getTime() - int(def.spanDays * DAY)),
        })
      }
    }
  }
  return out
}
