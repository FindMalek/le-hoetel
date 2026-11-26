import {
  CONSENT_WORDING_VERSION,
  type ConsentChannel,
  type ConsentSource,
  type GuestSource,
} from "@ritorno/common/consent"
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_HOTEL_SLUGS,
  DEMO_PHONE_RANGES,
  type DemoHotelSlug,
  demoOwnerEmail,
} from "@ritorno/common/demo"
import type { HotelLanguage, HotelPlan, HotelRole, HotelStatus } from "@ritorno/common/hotel"
import type {
  account,
  captureSpots,
  consentEvents,
  guestConsents,
  guests,
  guestVisits,
  hotelSettings,
  invitation,
  member,
  organization,
  user,
} from "../schema"
import { ORIGINS, type Origin } from "./names"
import { DAY, day, dice, HOUR, momentAgo } from "./random"

export const HISTORY_DAYS = 180

interface HotelDef {
  slug: DemoHotelSlug
  name: string
  city: string
  address: string
  language: HotelLanguage
  primary: string
  accent: string
  plan: HotelPlan
  status: HotelStatus
  pilotEndsInDays: number | null
  guests: number
  mix: Partial<Record<Origin, number>>
  /** Owner, manager, then two staff. */
  team: [string, string, string, string]
  /** What is left of the prepaid WhatsApp credit, in millimes. */
  balanceMillimes: number
}

export const DEMO_HOTELS: Record<DemoHotelSlug, HotelDef> = {
  "dar-zitouna": {
    slug: "dar-zitouna",
    name: "Dar Zitouna",
    city: "Monastir",
    address: "12 rue de la Kasbah, Monastir 5000, Tunisia",
    language: "fr",
    primary: "#1f6f8b",
    accent: "#a86a0a",
    plan: "starter",
    status: "pilot",
    pilotEndsInDays: 30,
    guests: 320,
    mix: { tn: 40, tn_ar: 15, fr: 25, dz: 5, de: 5, gb: 5, it: 5 },
    team: ["Sonia Ben Amor", "Hatem Gharbi", "Nesrine Ayari", "Bilel Mejri"],
    balanceMillimes: 38_500,
  },
  "sunset-bay": {
    slug: "sunset-bay",
    name: "Sunset Bay Resort",
    city: "Hammamet",
    address: "Route touristique Yasmine, Hammamet 8050, Tunisia",
    language: "en",
    primary: "#0b3d91",
    accent: "#cc4a17",
    plan: "pro",
    status: "active",
    pilotEndsInDays: null,
    guests: 480,
    mix: { fr: 25, de: 25, gb: 20, it: 10, tn: 12, tn_ar: 3, dz: 5 },
    team: ["Karim Trabelsi", "Leila Mansouri", "Yassine Dridi", "Rania Chebbi"],
    balanceMillimes: 126_000,
  },
  "villa-mimosa": {
    slug: "villa-mimosa",
    name: "Villa Mimosa Spa",
    city: "Djerba",
    address: "Zone touristique Sidi Mahres, Djerba 4116, Tunisia",
    language: "fr",
    primary: "#5b7f5a",
    accent: "#a8566b",
    plan: "growth",
    status: "active",
    pilotEndsInDays: null,
    guests: 380,
    mix: { fr: 40, tn: 15, tn_ar: 10, de: 15, it: 10, gb: 5, dz: 5 },
    team: ["Amira Zouari", "Fethi Belhaj", "Syrine Cherif", "Mourad Sassi"],
    balanceMillimes: 74_250,
  },
  "riad-dattier": {
    slug: "riad-dattier",
    name: "Riad Dattier",
    city: "Tozeur",
    address: "Avenue Abou el Kacem Chebbi, Tozeur 2200, Tunisia",
    language: "ar",
    primary: "#8a4b2a",
    accent: "#8c6d0f",
    plan: "starter",
    status: "pilot",
    pilotEndsInDays: 10,
    guests: 230,
    mix: { fr: 25, gb: 15, de: 10, it: 10, tn: 10, tn_ar: 20, dz: 10 },
    team: ["منى الحمامي", "نزار الخليفي", "وفاء الدريدي", "أيمن العياري"],
    balanceMillimes: 2_150,
  },
}

/** Mailbox names of a team, in the order of `team`. The owner's comes from `demoOwnerEmail`. */
const TEAM_ROLES: { key: string; role: HotelRole }[] = [
  { key: "owner", role: "owner" },
  { key: "manager", role: "manager" },
  { key: "reception", role: "staff" },
  { key: "service", role: "staff" },
]

const DESTINATIONS = ["Tozeur", "Djerba", "Tunis", "Sousse", "Douz", "Matmata", "Carthage", "Hammamet", "Monastir"]
const SOURCES: GuestSource[] = ["qr_room", "qr_room", "qr_room", "qr_table", "qr_front_desk", "staff", "csv"]
const WITHDRAW_SOURCES: ConsentSource[] = ["unsubscribe_link", "stop_reply", "guest_request"]
const ROOMS = ["101", "102", "103", "104", "105", "106", "108", "112", "201", "202", "204", "207", "210", "214"]
const TABLES = ["T1", "T2", "T3", "T4", "T6", "T8", "Terrasse 2", "Terrasse 5"]
/** The day of the one-off guest list import every hotel did when it joined. */
const IMPORT_DAYS_AGO = 150

type NewGuest = typeof guests.$inferInsert
type NewConsent = typeof guestConsents.$inferInsert
type NewEvent = typeof consentEvents.$inferInsert
type NewVisit = typeof guestVisits.$inferInsert

export interface HotelScenario {
  users: (typeof user.$inferInsert)[]
  accounts: (typeof account.$inferInsert)[]
  organizations: (typeof organization.$inferInsert)[]
  members: (typeof member.$inferInsert)[]
  invitations: (typeof invitation.$inferInsert)[]
  hotelSettings: (typeof hotelSettings.$inferInsert)[]
  guests: NewGuest[]
  guestConsents: NewConsent[]
  consentEvents: NewEvent[]
  guestVisits: NewVisit[]
  captureSpots: (typeof captureSpots.$inferInsert)[]
}

export const demoHotelId = (slug: DemoHotelSlug) => `demo-hotel-${slug}`

/**
 * Four demo hotels with their team, a super admin and some 1400 fake guests with consents, consent events and visits
 * over six months. Same seed, same people; only the dates move with `now`. Stays are columns of `guests`.
 */
export function buildHotelScenario(now: Date, passwordHash: string, seed = 20261124): HotelScenario {
  const { rand, int, pick, chance, digits, uuid } = dice(seed)
  const weighted = (mix: Partial<Record<Origin, number>>): Origin => {
    const entries = Object.entries(mix) as [Origin, number][]
    let roll = rand() * entries.reduce((sum, [, w]) => sum + w, 0)
    for (const [origin, w] of entries) {
      if (roll < w) return origin
      roll -= w
    }
    return entries[0]![0]
  }
  const ago = (days: number) => new Date(now.getTime() - days * DAY)

  const out: HotelScenario = {
    users: [],
    accounts: [],
    organizations: [],
    members: [],
    invitations: [],
    hotelSettings: [],
    guests: [],
    guestConsents: [],
    consentEvents: [],
    guestVisits: [],
    captureSpots: [],
  }
  const addUser = (row: typeof user.$inferInsert) => {
    out.users.push(row)
    out.accounts.push({
      id: `demo-account-${row.id}`,
      accountId: row.id,
      providerId: "credential",
      userId: row.id,
      password: passwordHash,
      createdAt: row.createdAt,
      updatedAt: row.createdAt,
    })
  }
  addUser({
    id: "demo-super-admin",
    name: "Demo Super Admin",
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    emailVerified: true,
    role: "admin",
    createdAt: ago(260),
    updatedAt: now,
  })

  for (const slug of DEMO_HOTEL_SLUGS) {
    const hotel = DEMO_HOTELS[slug]
    const hotelId = demoHotelId(slug)
    const hotelCreated = ago(HISTORY_DAYS + 20)
    const ownerId = `demo-owner-${slug}`

    out.organizations.push({ id: hotelId, name: hotel.name, slug, createdAt: hotelCreated })
    const staffIds = TEAM_ROLES.map(({ key, role }, i) => {
      const userId = key === "owner" ? ownerId : `demo-${key}-${slug}`
      const joinedAt = ago(HISTORY_DAYS + 20 - i * 6)
      addUser({
        id: userId,
        name: hotel.team[i]!,
        email: key === "owner" ? demoOwnerEmail(slug) : `${key}.${slug}@${DEMO_EMAIL_DOMAIN}`,
        emailVerified: true,
        createdAt: joinedAt,
        updatedAt: joinedAt,
      })
      out.members.push({
        id: `demo-member-${key === "owner" ? slug : `${key}-${slug}`}`,
        organizationId: hotelId,
        userId,
        role,
        createdAt: joinedAt,
      })
      return userId
    })
    // The saved list behind the QR page, so every spot a guest was captured at can be printed again.
    out.captureSpots.push(
      ...ROOMS.map((name) => ({ hotelId, source: "room" as const, name, createdAt: hotelCreated })),
      ...TABLES.map((name) => ({ hotelId, source: "table" as const, name, createdAt: hotelCreated })),
    )
    out.invitations.push({
      id: `demo-invite-${slug}`,
      organizationId: hotelId,
      email: `night.${slug}@${DEMO_EMAIL_DOMAIN}`,
      role: "staff",
      status: "pending",
      expiresAt: new Date(now.getTime() + 5 * DAY),
      createdAt: ago(2),
      inviterId: ownerId,
    })
    out.hotelSettings.push({
      organizationId: hotelId,
      displayName: hotel.name,
      primaryColor: hotel.primary,
      accentColor: hotel.accent,
      address: hotel.address,
      replyToEmail: `hello@${slug}.${DEMO_EMAIL_DOMAIN}`,
      defaultLanguage: hotel.language,
      googleReviewUrl: `https://search.google.com/local/writereview?placeid=demo-${slug}`,
      managerWhatsapp: `${DEMO_PHONE_RANGES.tn.prefix}${digits(DEMO_PHONE_RANGES.tn.digits)}`,
      plan: hotel.plan,
      status: hotel.status,
      pilotEndsAt: hotel.pilotEndsInDays === null ? null : new Date(now.getTime() + hotel.pilotEndsInDays * DAY),
      createdAt: hotelCreated,
    })

    const phones = new Set<string>()
    for (let n = 0; n < hotel.guests; n++) {
      const origin = ORIGINS[weighted(hotel.mix)]
      const range = DEMO_PHONE_RANGES[origin.phone]
      let phoneE164 = ""
      do phoneE164 = `${range.prefix}${digits(range.digits)}`
      while (phones.has(phoneE164))
      phones.add(phoneE164)

      const name = `${pick(origin.first)} ${pick(origin.last)}`
      const source = pick(SOURCES)
      // The power curve captures more guests in recent weeks, so the dashboard shows growth.
      const daysBack = source === "csv" ? IMPORT_DAYS_AGO : Math.floor(HISTORY_DAYS * rand() ** 1.4)
      const createdAt = momentAgo(now, daysBack, rand)
      const staffId = source === "staff" || source === "csv" ? pick(staffIds) : null
      const id = uuid()
      const email = chance(0.65) ? `guest.${slug}.${n + 1}@guest.${DEMO_EMAIL_DOMAIN}` : null

      const visits = [createdAt]
      if (daysBack > 15 && chance(0.28)) {
        for (let v = 0; v < 1 + int(3); v++) {
          const back = chance(0.35) ? int(14) : int(daysBack - 7)
          visits.push(momentAgo(now, back, rand))
        }
        visits.sort((a, b) => a.getTime() - b.getTime())
      }
      visits.forEach((at, i) => {
        out.guestVisits.push({ guestId: id, hotelId, source: i === 0 ? source : "staff", at })
      })
      const checkIn = visits.at(-1)!
      const checkOut = new Date(checkIn.getTime() + (2 + int(6)) * DAY)

      const asked: Record<ConsentChannel, boolean | null> = {
        whatsapp: chance(0.88),
        email: email ? chance(0.72) : null,
        profile: chance(0.65),
      }
      let profileGranted = asked.profile === true
      const events: NewEvent[] = []
      const base = { guestId: id, hotelId, wordingVersion: CONSENT_WORDING_VERSION }
      for (const channel of ["whatsapp", "email", "profile"] as const) {
        const granted = asked[channel]
        if (granted === null) continue
        events.push({ ...base, channel, granted, source, staffUserId: staffId, at: createdAt })
        const at = new Date(createdAt.getTime() + (1 + int(30)) * DAY + int(10) * HOUR)
        if (granted && at < now && chance(0.07)) {
          const withdrawnBy = pick(WITHDRAW_SOURCES)
          events.push({
            ...base,
            channel,
            granted: false,
            source: withdrawnBy,
            staffUserId: withdrawnBy === "guest_request" ? pick(staffIds) : null,
            at,
          })
          if (channel === "profile") profileGranted = false
        }
      }
      for (const channel of ["whatsapp", "email", "profile"] as const) {
        const last = events.filter((e) => e.channel === channel).at(-1)
        if (last)
          out.guestConsents.push({
            ...base,
            channel,
            granted: last.granted,
            source: last.source,
            updatedAt: last.at,
          })
      }
      out.consentEvents.push(...events)

      // A few birthdays today and this week, so the birthday screens and messages have something to show.
      const soon = n % 41 === 0 ? 0 : n % 29 === 0 ? 1 + int(6) : null
      const birthday =
        soon !== null
          ? `${1960 + int(40)}-${day(new Date(now.getTime() + soon * DAY)).slice(5)}`
          : chance(0.6)
            ? `${1960 + int(42)}-${String(1 + int(12)).padStart(2, "0")}-${String(1 + int(28)).padStart(2, "0")}`
            : null

      out.guests.push({
        id,
        hotelId,
        name,
        phoneE164,
        language: origin.language,
        email,
        // 29 February of a common year is not a date.
        birthday: birthday?.endsWith("02-29") ? birthday.replace("02-29", "02-28") : birthday,
        source,
        // The front desk has one code, without a spot.
        captureLocation: source === "qr_room" ? pick(ROOMS) : source === "qr_table" ? pick(TABLES) : null,
        country: profileGranted ? origin.country : null,
        city: profileGranted ? pick(origin.cities) : null,
        stayCheckIn: profileGranted ? day(checkIn) : null,
        stayCheckOut: profileGranted ? day(checkOut) : null,
        nextDestination: profileGranted && chance(0.5) ? pick(DESTINATIONS) : null,
        createdAt,
        updatedAt: createdAt,
      })
    }
  }
  return out
}
