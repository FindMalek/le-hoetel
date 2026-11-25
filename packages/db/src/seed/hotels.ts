import {
  CONSENT_WORDING_VERSION,
  type ConsentChannel,
  type ConsentSource,
  type GuestSource,
} from "@le-hoetel/common/consent"
import { DEMO_EMAIL_DOMAIN, DEMO_HOTEL_SLUGS, type DemoHotelSlug, demoOwnerEmail } from "@le-hoetel/common/demo"
import type { HotelLanguage, HotelPlan, HotelStatus } from "@le-hoetel/common/hotel"
import type {
  account,
  consentEvents,
  guestConsents,
  guests,
  hotelSettings,
  member,
  organization,
  user,
} from "../schema"
import { ORIGINS, type Origin } from "./names"
import { random } from "./random"

const DAY = 864e5
const HISTORY_DAYS = 110

interface HotelDef {
  slug: DemoHotelSlug
  name: string
  city: string
  language: HotelLanguage
  primary: string
  accent: string
  plan: HotelPlan
  status: HotelStatus
  guests: number
  mix: Partial<Record<Origin, number>>
}

export const DEMO_HOTELS: Record<DemoHotelSlug, HotelDef> = {
  "dar-zitouna": {
    slug: "dar-zitouna",
    name: "Dar Zitouna",
    city: "Monastir",
    language: "fr",
    primary: "#1f6f8b",
    accent: "#e8a33d",
    plan: "starter",
    status: "pilot",
    guests: 90,
    mix: { tn: 40, tn_ar: 15, fr: 25, dz: 5, de: 5, gb: 5, it: 5 },
  },
  "sunset-bay": {
    slug: "sunset-bay",
    name: "Sunset Bay Resort",
    city: "Hammamet",
    language: "en",
    primary: "#0b3d91",
    accent: "#f26b3a",
    plan: "pro",
    status: "active",
    guests: 160,
    mix: { fr: 25, de: 25, gb: 20, it: 10, tn: 12, tn_ar: 3, dz: 5 },
  },
  "villa-mimosa": {
    slug: "villa-mimosa",
    name: "Villa Mimosa Spa",
    city: "Djerba",
    language: "fr",
    primary: "#5b7f5a",
    accent: "#d9a5b3",
    plan: "growth",
    status: "active",
    guests: 120,
    mix: { fr: 40, tn: 15, tn_ar: 10, de: 15, it: 10, gb: 5, dz: 5 },
  },
  "riad-dattier": {
    slug: "riad-dattier",
    name: "Riad Dattier",
    city: "Tozeur",
    language: "ar",
    primary: "#8a4b2a",
    accent: "#c9a227",
    plan: "starter",
    status: "pilot",
    guests: 70,
    mix: { fr: 30, gb: 20, de: 15, it: 10, tn: 10, tn_ar: 5, dz: 10 },
  },
}

const DESTINATIONS = ["Tozeur", "Djerba", "Tunis", "Sousse", "Douz", "Matmata", "Carthage", "Hammamet", "Monastir"]
const SOURCES: GuestSource[] = ["qr_room", "qr_room", "qr_room", "qr_table", "qr_front_desk", "staff", "csv"]
const WITHDRAW_SOURCES: ConsentSource[] = ["unsubscribe_link", "stop_reply", "guest_request"]

type NewGuest = typeof guests.$inferInsert
type NewConsent = typeof guestConsents.$inferInsert
type NewEvent = typeof consentEvents.$inferInsert

export interface HotelScenario {
  users: (typeof user.$inferInsert)[]
  accounts: (typeof account.$inferInsert)[]
  organizations: (typeof organization.$inferInsert)[]
  members: (typeof member.$inferInsert)[]
  hotelSettings: (typeof hotelSettings.$inferInsert)[]
  guests: NewGuest[]
  guestConsents: NewConsent[]
  consentEvents: NewEvent[]
}

const day = (date: Date) => date.toISOString().slice(0, 10)

/**
 * Four demo hotels with their owner, a super admin and a few hundred fake guests, consents and consent events.
 * Same seed, same people; only the dates move with `now`. Stays are columns of `guests` for now (no stays table yet).
 */
export function buildHotelScenario(now: Date, passwordHash: string, seed = 20261124): HotelScenario {
  const rand = random(seed)
  const int = (max: number) => Math.floor(rand() * max)
  const pick = <T>(items: readonly T[]): T => items[int(items.length)]!
  const pickChar = (chars: string) => chars[int(chars.length)]!
  const digits = (n: number) => Array.from({ length: n }, () => int(10)).join("")
  const uuid = () => {
    const hex = Array.from({ length: 32 }, () => int(16).toString(16))
    hex[12] = "4"
    hex[16] = "89ab"[int(4)]!
    const h = hex.join("")
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
  }
  const weighted = (mix: Partial<Record<Origin, number>>): Origin => {
    const entries = Object.entries(mix) as [Origin, number][]
    const total = entries.reduce((sum, [, w]) => sum + w, 0)
    let roll = rand() * total
    for (const [origin, w] of entries) {
      if (roll < w) return origin
      roll -= w
    }
    return entries[0]![0]
  }
  const capped = (date: Date) => new Date(Math.min(now.getTime(), date.getTime()))

  const out: HotelScenario = {
    users: [
      {
        id: "demo-super-admin",
        name: "Demo Super Admin",
        email: `admin@${DEMO_EMAIL_DOMAIN}`,
        emailVerified: true,
        role: "admin",
        createdAt: new Date(now.getTime() - 200 * DAY),
        updatedAt: now,
      },
    ],
    accounts: [],
    organizations: [],
    members: [],
    hotelSettings: [],
    guests: [],
    guestConsents: [],
    consentEvents: [],
  }
  const addAccount = (userId: string, createdAt: Date) =>
    out.accounts.push({
      id: `demo-account-${userId}`,
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
      createdAt,
      updatedAt: createdAt,
    })
  addAccount("demo-super-admin", out.users[0]!.createdAt!)

  for (const slug of DEMO_HOTEL_SLUGS) {
    const hotel = DEMO_HOTELS[slug]
    const hotelId = `demo-hotel-${slug}`
    const hotelCreated = new Date(now.getTime() - (HISTORY_DAYS + 20) * DAY)
    const ownerId = `demo-owner-${slug}`

    out.organizations.push({ id: hotelId, name: hotel.name, slug, createdAt: hotelCreated })
    out.users.push({
      id: ownerId,
      name: `${hotel.name} owner`,
      email: demoOwnerEmail(slug),
      emailVerified: true,
      createdAt: hotelCreated,
      updatedAt: hotelCreated,
    })
    addAccount(ownerId, hotelCreated)
    out.members.push({
      id: `demo-member-${slug}`,
      organizationId: hotelId,
      userId: ownerId,
      role: "owner",
      createdAt: hotelCreated,
    })
    out.hotelSettings.push({
      organizationId: hotelId,
      displayName: hotel.name,
      primaryColor: hotel.primary,
      accentColor: hotel.accent,
      address: `${hotel.name}, ${hotel.city}, Tunisia`,
      replyToEmail: `hello@${slug}.${DEMO_EMAIL_DOMAIN}`,
      defaultLanguage: hotel.language,
      googleReviewUrl: `https://search.google.com/local/writereview?placeid=demo-${slug}`,
      managerWhatsapp: `+216${pickChar("2459")}${digits(7)}`,
      plan: hotel.plan,
      status: hotel.status,
      pilotEndsAt: hotel.status === "pilot" ? new Date(now.getTime() + 30 * DAY) : null,
      createdAt: hotelCreated,
    })

    const phones = new Set<string>()
    for (let n = 0; n < hotel.guests; n++) {
      const origin = ORIGINS[weighted(hotel.mix)]
      let phoneE164 = origin.phone(digits, pickChar)
      while (phones.has(phoneE164)) phoneE164 = origin.phone(digits, pickChar)
      phones.add(phoneE164)

      const name = `${pick(origin.first)} ${pick(origin.last)}`
      // Squared roll: more captures in recent weeks, so the dashboard shows growth.
      const checkIn = new Date(now.getTime() - Math.floor((1 - Math.sqrt(rand())) * HISTORY_DAYS * DAY))
      const checkOut = new Date(checkIn.getTime() + (2 + int(6)) * DAY)
      const createdAt = capped(new Date(checkIn.getTime() + int(2) * DAY))
      const source = pick(SOURCES)
      const id = uuid()
      const email = rand() < 0.6 ? `guest.${slug}.${n + 1}@guest.${DEMO_EMAIL_DOMAIN}` : null

      const asked: Record<ConsentChannel, boolean | null> = {
        whatsapp: rand() < 0.88,
        email: email ? rand() < 0.7 : null,
        profile: rand() < 0.55,
      }
      let profileGranted = asked.profile === true
      const events: NewEvent[] = []
      for (const channel of ["whatsapp", "email", "profile"] as const) {
        const granted = asked[channel]
        if (granted === null) continue
        events.push({
          guestId: id,
          hotelId,
          channel,
          granted,
          source,
          wordingVersion: CONSENT_WORDING_VERSION,
          at: createdAt,
        })
        if (granted && rand() < 0.08) {
          const at = capped(new Date(createdAt.getTime() + (1 + int(30)) * DAY))
          events.push({
            guestId: id,
            hotelId,
            channel,
            granted: false,
            source: pick(WITHDRAW_SOURCES),
            wordingVersion: CONSENT_WORDING_VERSION,
            at,
          })
          if (channel === "profile") profileGranted = false
        }
      }
      for (const channel of ["whatsapp", "email", "profile"] as const) {
        const last = events.filter((e) => e.channel === channel).at(-1)
        if (last)
          out.guestConsents.push({
            guestId: id,
            hotelId,
            channel,
            granted: last.granted,
            source: last.source,
            wordingVersion: last.wordingVersion,
            updatedAt: last.at,
          })
      }
      out.consentEvents.push(...events)

      out.guests.push({
        id,
        hotelId,
        name,
        phoneE164,
        language: origin.language,
        email,
        birthday:
          rand() < 0.5
            ? `${1960 + int(42)}-${String(1 + int(12)).padStart(2, "0")}-${String(1 + int(28)).padStart(2, "0")}`
            : null,
        source,
        country: profileGranted ? origin.country : null,
        city: profileGranted ? pick(origin.cities) : null,
        stayCheckIn: profileGranted ? day(checkIn) : null,
        stayCheckOut: profileGranted ? day(checkOut) : null,
        nextDestination: profileGranted && rand() < 0.5 ? pick(DESTINATIONS) : null,
        createdAt,
        updatedAt: createdAt,
      })
    }
  }
  return out
}
