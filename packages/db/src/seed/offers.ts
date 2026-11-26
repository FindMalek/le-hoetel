import type { offerCodes, offerRedemptions, offers } from "../schema"
import type { HotelScenario } from "./hotels"
import { DAY, dice, earlier, HOUR } from "./random"

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
  /** Days from now; negative is already over, null never ends. */
  endsInDays: number | null
  max: number | null
  active: boolean
  /** Share of the hotel's guests who got a code, and of those who redeemed it. */
  issued: number
  redeemed: number
}

const DEFS: OfferDef[] = [
  {
    key: "welcome",
    title: "Welcome drink",
    text: "A fresh juice or a mint tea at the bar, on us. Show the QR to the bartender.",
    promoCode: "WELCOME",
    trigger: "welcome",
    startedDaysAgo: 185,
    endsInDays: null,
    max: null,
    active: true,
    issued: 0.65,
    redeemed: 0.55,
  },
  {
    key: "birthday",
    title: "Birthday dessert",
    text: "A dessert and a candle at dinner during your birthday week.",
    promoCode: "BIRTHDAY",
    trigger: "birthday",
    startedDaysAgo: 175,
    endsInDays: null,
    max: null,
    active: true,
    issued: 1,
    redeemed: 0.5,
  },
  {
    key: "spa",
    title: "Spa credit for a late checkout",
    text: "10 TND off a massage when you leave after noon.",
    promoCode: "SPA10",
    trigger: null,
    startedDaysAgo: 60,
    endsInDays: 15,
    max: 150,
    active: true,
    issued: 0.25,
    redeemed: 0.35,
  },
  {
    key: "summer",
    title: "Summer sunset cocktail",
    text: "Two for one on the terrace between 18:00 and 20:00.",
    promoCode: "SUNSET2",
    trigger: null,
    startedDaysAgo: 160,
    endsInDays: -70,
    max: null,
    active: true,
    issued: 0.2,
    redeemed: 0.5,
  },
  {
    key: "dinner",
    title: "Chef's table for two",
    text: "A tasting menu at the chef's table, first come first served.",
    promoCode: "CHEF2",
    trigger: null,
    startedDaysAgo: 45,
    endsInDays: null,
    max: 8,
    active: false,
    issued: 0.05,
    redeemed: 1,
  },
]

/** The latest morning a `YYYY-MM-DD` birthday fell between `from` and `now`, if any. */
function birthdaySince(birthday: string | null | undefined, from: Date, now: Date): Date | null {
  if (!birthday) return null
  for (const year of [now.getUTCFullYear(), now.getUTCFullYear() - 1]) {
    const at = new Date(`${year}-${birthday.slice(5)}T08:05:00Z`)
    if (at >= from && at < now) return at
  }
  return null
}

export const OFFERS_PER_HOTEL = DEFS.length

/** Offers per demo hotel, the codes guests hold and who redeemed what: some open, some past their end date, fully used or paused. */
export function buildOfferScenario(now: Date, hotels: HotelScenario, seed = 20261125): OfferScenario {
  const { rand, int, pick, chance, uuid } = dice(seed)
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
    const staff = hotels.members.filter((m) => m.organizationId === hotelId).map((m) => m.userId)
    const people = hotels.guests.filter((g) => g.hotelId === hotelId)
    for (const def of DEFS) {
      const offerId = uuid()
      const start = new Date(now.getTime() - def.startedDaysAgo * DAY)
      const end = def.endsInDays === null ? null : new Date(now.getTime() + def.endsInDays * DAY)
      const last = end ? earlier(now, end) : now
      out.offers.push({
        id: offerId,
        hotelId,
        title: def.title,
        text: def.text,
        promoCode: def.promoCode,
        trigger: def.trigger,
        validFrom: start,
        validUntil: end,
        maxRedemptions: def.max,
        active: def.active,
        createdAt: start,
        updatedAt: start,
      })
      let redeemed = 0
      for (const guest of people) {
        const known = guest.createdAt!
        // The birthday perk only goes to a guest whose birthday came round since they joined.
        const birthday = def.trigger === "birthday" ? birthdaySince(guest.birthday, known, now) : null
        if (known > last || (def.trigger === "birthday" ? !birthday : !chance(def.issued))) continue
        // The welcome code goes out with the welcome message, the others at any time while the offer runs.
        const from = new Date(Math.max(start.getTime(), known.getTime()))
        const issuedAt =
          birthday ??
          (def.trigger === "welcome" ? from : new Date(from.getTime() + rand() * Math.max(0, last.getTime() - +from)))
        out.offerCodes.push({ offerId, hotelId, guestId: guest.id!, code: code(), createdAt: issuedAt })
        const redeemedAt = new Date(issuedAt.getTime() + HOUR / 2 + rand() * 40 * HOUR)
        if (redeemedAt >= now || !chance(def.redeemed) || (def.max !== null && redeemed >= def.max)) continue
        redeemed++
        out.offerRedemptions.push({
          offerId,
          hotelId,
          guestId: guest.id!,
          redeemedBy: pick(staff),
          redeemedAt,
        })
      }
    }
  }
  return out
}
