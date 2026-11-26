import { createHash } from "node:crypto"
import {
  CONSENT_CHANNELS,
  CONSENT_WORDING_VERSION,
  type ConsentChannel,
  type ConsentSource,
  type GuestSource,
} from "@ritorno/common/consent"
import { isSameLocalDay } from "@ritorno/common/hotel-time"
import { GUEST_MERGE_FIELDS, type Guest, type GuestUpsertResult, type guestCreateSchema } from "@ritorno/common/schemas"
import {
  consentEvents,
  type Db,
  guestConsents,
  guests,
  guestVisits,
  hotelSettings,
  offerRedemptions,
  offers,
} from "@ritorno/db"
import { and, count, desc, eq, gt, inArray, max, min } from "drizzle-orm"
import type { z } from "zod"

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

/** The only way to read one hotel's guests: a guest id alone never selects a row. */
export const hotelGuest = (hotelId: string, guestId: string) => and(eq(guests.hotelId, hotelId), eq(guests.id, guestId))

/** What the audit log keeps of a deleted guest: enough to prove a deletion, nothing that points back to a person. */
export const hashGuestId = (guestId: string): string => createHash("sha256").update(guestId).digest("hex")

export interface ConsentChange {
  hotelId: string
  guestId: string
  channel: ConsentChannel
  granted: boolean
  source: ConsentSource
  at: Date
  ipHash?: string | null
  /** Only when a signed-in staff member made the change. */
  staffUserId?: string
}

/**
 * Sets the current consent and appends the event in one transaction. Asking again with the same answer is a
 * no-op, but a first answer is always logged, a "no" included. Returns whether anything changed.
 */
export async function recordConsent(db: Db | Tx, change: ConsentChange): Promise<boolean> {
  const [current] = await db
    .select({ granted: guestConsents.granted })
    .from(guestConsents)
    .where(
      and(
        eq(guestConsents.hotelId, change.hotelId),
        eq(guestConsents.guestId, change.guestId),
        eq(guestConsents.channel, change.channel),
      ),
    )
  if (current?.granted === change.granted) return false
  const state = {
    granted: change.granted,
    source: change.source,
    wordingVersion: CONSENT_WORDING_VERSION,
    updatedAt: change.at,
  }
  await db
    .insert(guestConsents)
    .values({ guestId: change.guestId, hotelId: change.hotelId, channel: change.channel, ...state })
    .onConflictDoUpdate({ target: [guestConsents.guestId, guestConsents.channel], set: state })
  await db.insert(consentEvents).values({
    guestId: change.guestId,
    hotelId: change.hotelId,
    channel: change.channel,
    granted: change.granted,
    source: change.source,
    wordingVersion: CONSENT_WORDING_VERSION,
    ipHash: change.ipHash ?? null,
    staffUserId: change.staffUserId ?? null,
    at: change.at,
  })
  return true
}

/** Guests of `hotelId` with their current consents, `false` where a guest never answered. */
export async function withConsents(
  db: Db | Tx,
  hotelId: string,
  rows: (typeof guests.$inferSelect)[],
): Promise<Guest[]> {
  if (!rows.length) return []
  const states = await db
    .select()
    .from(guestConsents)
    .where(
      and(
        eq(guestConsents.hotelId, hotelId),
        inArray(
          guestConsents.guestId,
          rows.map((row) => row.id),
        ),
      ),
    )
  return rows.map(({ hotelId: _hotelId, ...guest }) => {
    const consents = Object.fromEntries(CONSENT_CHANNELS.map((channel) => [channel, false])) as Guest["consents"]
    for (const state of states) if (state.guestId === guest.id) consents[state.channel] = state.granted
    return { ...guest, consents }
  })
}

async function timezoneOf(db: Db | Tx, hotelId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: hotelSettings.timezone })
    .from(hotelSettings)
    .where(eq(hotelSettings.organizationId, hotelId))
  return row?.timezone ?? "Africa/Tunis"
}

/**
 * Records that the guest is here, at most once per hotel day. The guest row is locked so a rescan and a staff tap
 * at the same moment count once. Returns the new visit's id, null when that day was already counted.
 */
export async function recordVisit(
  db: Db | Tx,
  visit: { hotelId: string; guestId: string; source: GuestSource; at: Date },
): Promise<string | null> {
  const { hotelId, guestId, at } = visit
  return db.transaction(async (tx) => {
    await tx.select({ id: guests.id }).from(guests).where(hotelGuest(hotelId, guestId)).for("no key update")
    const timeZone = await timezoneOf(tx, hotelId)
    const recent = await tx
      .select({ at: guestVisits.at })
      .from(guestVisits)
      .where(
        and(
          eq(guestVisits.hotelId, hotelId),
          eq(guestVisits.guestId, guestId),
          // no timezone's day is longer than this
          gt(guestVisits.at, new Date(at.getTime() - 48 * 3_600_000)),
        ),
      )
    if (recent.some((row) => isSameLocalDay(row.at, at, timeZone))) return null
    const [row] = await tx.insert(guestVisits).values(visit).returning({ id: guestVisits.id })
    return row!.id
  })
}

export type GuestInput = z.output<typeof guestCreateSchema>

type MergeReport = Pick<GuestUpsertResult, "changed" | "kept">

function compareMerge(
  before: typeof guests.$inferSelect,
  after: Partial<typeof guests.$inferSelect>,
  typed: Omit<GuestInput, "consents" | "phone">,
): MergeReport {
  return {
    changed: GUEST_MERGE_FIELDS.filter((field) => (after[field] ?? null) !== (before[field] ?? null)),
    kept: GUEST_MERGE_FIELDS.filter((field) => typed[field] != null && typed[field] !== after[field]),
  }
}

/**
 * One phone is one guest per hotel. A new phone creates the guest. A known phone merges into the existing guest:
 * name, email, birthday, country and city only fill gaps, language and stay details take the latest value, and
 * consent answers go through `recordConsent`. A merge only adds consent, never withdraws it or clears extras:
 * anyone who knows a phone can rescan the public QR form. Withdrawal is unsubscribe, STOP or `setConsent`.
 * A csv row never re-grants a channel the guest withdrew (a "no" after an earlier "yes"): an old list must not
 * override an unsubscribe, only the guest can opt in again. `consentKept` reports such a row.
 * Anything but a csv row also counts a visit, new or known phone.
 */
export async function upsertGuest(
  tx: Tx,
  hotelId: string,
  input: GuestInput,
  at: Date,
  staffUserId?: string,
): Promise<{ id: string; merged: boolean; consentKept: boolean; visitRecorded: boolean } & MergeReport> {
  const { consents, phone, ...fields } = input
  const [created] = await tx
    .insert(guests)
    .values({ ...fields, phoneE164: phone, hotelId })
    .onConflictDoNothing({ target: [guests.hotelId, guests.phoneE164] })
    .returning({ id: guests.id })
  let id = created?.id
  let report: MergeReport = { changed: [], kept: [] }
  if (!id) {
    const [existing] = await tx
      .select()
      .from(guests)
      .where(and(eq(guests.hotelId, hotelId), eq(guests.phoneE164, phone)))
      .for("update")
    id = existing!.id
    const merged = {
      name: existing!.name || fields.name,
      email: existing!.email ?? fields.email,
      birthday: existing!.birthday ?? fields.birthday,
      country: existing!.country ?? fields.country,
      city: existing!.city ?? fields.city,
      language: fields.language,
      stayCheckIn: fields.stayCheckIn ?? existing!.stayCheckIn,
      stayCheckOut: fields.stayCheckOut ?? existing!.stayCheckOut,
      nextDestination: fields.nextDestination ?? existing!.nextDestination,
    }
    await tx.update(guests).set(merged).where(hotelGuest(hotelId, id))
    report = compareMerge(existing!, { ...existing, ...merged }, fields)
  }
  const visitRecorded =
    fields.source !== "csv" && !!(await recordVisit(tx, { hotelId, guestId: id, source: fields.source, at }))
  const current = created
    ? {}
    : Object.fromEntries(
        (
          await tx
            .select({ channel: guestConsents.channel, granted: guestConsents.granted })
            .from(guestConsents)
            .where(and(eq(guestConsents.hotelId, hotelId), eq(guestConsents.guestId, id)))
        ).map((row) => [row.channel, row.granted]),
      )
  const withdrawn =
    fields.source === "csv" ? await withdrawnChannels(tx, hotelId, id, current) : new Set<ConsentChannel>()
  let consentKept = false
  for (const channel of CONSENT_CHANNELS) {
    const granted = consents[channel]
    if (!granted && current[channel]) continue
    if (granted && withdrawn.has(channel)) {
      consentKept = true
      continue
    }
    const change = { hotelId, guestId: id, channel, granted, source: fields.source, at, staffUserId }
    if ((await recordConsent(tx, change)) && granted && !created) report.changed.push(`${channel}Consent`)
  }
  return { id, merged: !created, consentKept, visitRecorded, ...report }
}

async function withdrawnChannels(
  tx: Tx,
  hotelId: string,
  guestId: string,
  current: Partial<Record<ConsentChannel, boolean>>,
): Promise<Set<ConsentChannel>> {
  const off = CONSENT_CHANNELS.filter((channel) => current[channel] === false)
  if (!off.length) return new Set()
  const everGranted = await tx
    .selectDistinct({ channel: consentEvents.channel })
    .from(consentEvents)
    .where(
      and(
        eq(consentEvents.hotelId, hotelId),
        eq(consentEvents.guestId, guestId),
        eq(consentEvents.granted, true),
        inArray(consentEvents.channel, off),
      ),
    )
  return new Set(everGranted.map((row) => row.channel))
}

export const clearExtras = (db: Db | Tx, hotelId: string, guestId: string) =>
  db
    .update(guests)
    .set({ country: null, city: null, stayCheckIn: null, stayCheckOut: null, nextDestination: null })
    .where(hotelGuest(hotelId, guestId))

/** What the front desk needs to greet a guest: visits, consents and the last offer used. Always one hotel's guests. */
export async function recognitionOf(db: Db | Tx, hotelId: string, rows: (typeof guests.$inferSelect)[], now: Date) {
  const ids = rows.map((row) => row.id)
  if (!ids.length) return []
  const [timeZone, visits, consents, redemptions] = await Promise.all([
    timezoneOf(db, hotelId),
    db
      .select({
        guestId: guestVisits.guestId,
        n: count(),
        first: min(guestVisits.at),
        last: max(guestVisits.at),
      })
      .from(guestVisits)
      .where(and(eq(guestVisits.hotelId, hotelId), inArray(guestVisits.guestId, ids)))
      .groupBy(guestVisits.guestId),
    withConsents(db, hotelId, rows),
    db
      .select({ guestId: offerRedemptions.guestId, title: offers.title, at: offerRedemptions.redeemedAt })
      .from(offerRedemptions)
      .innerJoin(offers, and(eq(offers.id, offerRedemptions.offerId), eq(offers.hotelId, offerRedemptions.hotelId)))
      .where(and(eq(offerRedemptions.hotelId, hotelId), inArray(offerRedemptions.guestId, ids)))
      .orderBy(desc(offerRedemptions.redeemedAt)),
  ])
  return rows.map((row) => {
    const seen = visits.find((visit) => visit.guestId === row.id)
    const offer = redemptions.find((redemption) => redemption.guestId === row.id)
    const guest = consents.find((item) => item.id === row.id)!
    return {
      id: row.id,
      name: row.name,
      phoneE164: row.phoneE164,
      language: row.language,
      consents: { email: guest.consents.email, whatsapp: guest.consents.whatsapp },
      visits: seen?.n ?? 0,
      firstVisitAt: seen?.first ?? null,
      lastVisitAt: seen?.last ?? null,
      visitedToday: !!seen?.last && isSameLocalDay(seen.last, now, timeZone),
      lastOffer: offer ? { title: offer.title, at: offer.at } : null,
    }
  })
}
