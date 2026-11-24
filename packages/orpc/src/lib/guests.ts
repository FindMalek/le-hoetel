import {
  CONSENT_CHANNELS,
  CONSENT_WORDING_VERSION,
  type ConsentChannel,
  type ConsentSource,
} from "@le-hoetel/common/consent"
import type { Guest } from "@le-hoetel/common/schemas"
import { consentEvents, type Db, guestConsents, guests } from "@le-hoetel/db"
import { and, eq, inArray } from "drizzle-orm"

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

/** The only way to read one hotel's guests: a guest id alone never selects a row. */
export const hotelGuest = (hotelId: string, guestId: string) => and(eq(guests.hotelId, hotelId), eq(guests.id, guestId))

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
