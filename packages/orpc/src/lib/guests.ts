import { createHash } from "node:crypto"
import {
  CONSENT_CHANNELS,
  CONSENT_WORDING_VERSION,
  type ConsentChannel,
  type ConsentSource,
} from "@ritorno/common/consent"
import type { Guest, guestCreateSchema } from "@ritorno/common/schemas"
import { consentEvents, type Db, guestConsents, guests, guestVisits, offerRedemptions, offers } from "@ritorno/db"
import { and, count, desc, eq, inArray, max, min } from "drizzle-orm"
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

export type GuestInput = z.output<typeof guestCreateSchema>

/** Staff and imports must not undo what a guest agreed to: from them only a first answer or a "yes" counts. */
const OVERRIDES_CONSENT = new Set<ConsentSource>(["qr_room", "qr_table", "qr_front_desk"])

/**
 * One phone is one guest per hotel. A new phone creates the guest. A known phone merges into the existing guest:
 * name, email, birthday, country and city only fill gaps, language and stay details take the latest value, and
 * consent answers go through `recordConsent`. A "no" from staff or a csv never withdraws an existing "yes".
 */
export async function upsertGuest(
  tx: Tx,
  hotelId: string,
  input: GuestInput,
  at: Date,
): Promise<{ id: string; merged: boolean }> {
  const { consents, phone, ...fields } = input
  const [created] = await tx
    .insert(guests)
    .values({ ...fields, phoneE164: phone, hotelId })
    .onConflictDoNothing({ target: [guests.hotelId, guests.phoneE164] })
    .returning({ id: guests.id })
  let id = created?.id
  if (created && fields.source !== "csv") {
    await tx.insert(guestVisits).values({ guestId: created.id, hotelId, source: fields.source, at })
  }
  if (!id) {
    const [existing] = await tx
      .select()
      .from(guests)
      .where(and(eq(guests.hotelId, hotelId), eq(guests.phoneE164, phone)))
      .for("update")
    id = existing!.id
    await tx
      .update(guests)
      .set({
        name: existing!.name || fields.name,
        email: existing!.email ?? fields.email,
        birthday: existing!.birthday ?? fields.birthday,
        country: existing!.country ?? fields.country,
        city: existing!.city ?? fields.city,
        language: fields.language,
        stayCheckIn: fields.stayCheckIn ?? existing!.stayCheckIn,
        stayCheckOut: fields.stayCheckOut ?? existing!.stayCheckOut,
        nextDestination: fields.nextDestination ?? existing!.nextDestination,
      })
      .where(hotelGuest(hotelId, id))
  }
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
  for (const channel of CONSENT_CHANNELS) {
    const granted = consents[channel]
    if (!granted && current[channel] && !OVERRIDES_CONSENT.has(fields.source)) continue
    await recordConsent(tx, { hotelId, guestId: id, channel, granted, source: fields.source, at })
  }
  if (!created && !consents.profile && current.profile !== false && OVERRIDES_CONSENT.has(fields.source)) {
    await clearExtras(tx, hotelId, id)
  }
  return { id, merged: !created }
}

export const clearExtras = (db: Db | Tx, hotelId: string, guestId: string) =>
  db
    .update(guests)
    .set({ country: null, city: null, stayCheckIn: null, stayCheckOut: null, nextDestination: null })
    .where(hotelGuest(hotelId, guestId))

/** What the front desk needs to greet a guest: visits, consents and the last offer used. Always one hotel's guests. */
export async function recognitionOf(db: Db | Tx, hotelId: string, rows: (typeof guests.$inferSelect)[]) {
  const ids = rows.map((row) => row.id)
  if (!ids.length) return []
  const [visits, consents, redemptions] = await Promise.all([
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
      lastOffer: offer ? { title: offer.title, at: offer.at } : null,
    }
  })
}
