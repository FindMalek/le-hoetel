import { DEFAULT_DEMO_PASSWORD } from "@ritorno/common/demo"
import type { Storage } from "@ritorno/storage"
import { count, eq, getTableColumns } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"
import type { Db } from "../index"
import {
  account,
  auditLog,
  automationSends,
  balanceLedger,
  campaignRecipients,
  campaigns,
  captureSpots,
  consentEvents,
  feedbackCases,
  guestConsents,
  guests,
  guestVisits,
  hotelBalance,
  hotelHolidays,
  hotelSettings,
  inboxItem,
  invitation,
  member,
  messages,
  notes,
  offerCodes,
  offerRedemptions,
  offers,
  organization,
  surveyInvites,
  surveyResponses,
  user,
} from "../schema"
import { buildActivityScenario } from "./activity"
import { assertSeedable, type SeedTarget } from "./guard"
import { buildHotelScenario } from "./hotels"
import { uploadDemoLogos } from "./logos"
import { buildMessageScenario } from "./messages"
import { buildOfferScenario } from "./offers"
import { buildScenario } from "./scenario"
import { buildSurveyScenario } from "./surveys"

export { assertSeedable, seedRefusal } from "./guard"
export { buildHotelScenario } from "./hotels"
export { buildOfferScenario } from "./offers"
export { buildScenario } from "./scenario"
export { buildSurveyScenario } from "./surveys"

/** `databaseUrl` is the one `db` is connected to: it is what keeps the demo out of a remote database. */
export interface SeedOptions extends SeedTarget {
  ownerId?: string
  /** The demo accounts share one password; pass the auth library's hasher so they can sign in. */
  hashPassword: (password: string) => Promise<string>
  demoPassword?: string
  /** Where the demo logos go. Without it the hotels show their initial. */
  storage?: Pick<Storage, "prefix" | "put"> | null
  /** Used by the links inside the message previews. */
  webUrl?: string
  apiUrl?: string
}

/** Postgres takes 65535 parameters a statement. */
async function insertAll<T extends PgTable>(tx: Pick<Db, "insert">, table: T, rows: T["$inferInsert"][]) {
  const size = Math.floor(60_000 / Object.keys(getTableColumns(table)).length)
  for (let i = 0; i < rows.length; i += size) await tx.insert(table).values(rows.slice(i, i + size))
}

/**
 * Writes the demo into an empty database only, so it never touches real data. One section per feature: a later
 * feature appends its own rows to a scenario file and its insert below, after the rows it points at.
 */
export async function seedDemo(db: Db, opts: SeedOptions): Promise<boolean> {
  assertSeedable(opts)
  const [existingNotes] = await db.select({ n: count() }).from(notes)
  const [existingHotels] = await db.select({ n: count() }).from(organization)
  if ((existingNotes?.n ?? 0) + (existingHotels?.n ?? 0) > 0) return false

  const now = new Date()
  const scenario = buildScenario(now, opts)
  const hotels = buildHotelScenario(now, await opts.hashPassword(opts.demoPassword || DEFAULT_DEMO_PASSWORD))
  const logoKeys = opts.storage ? await uploadDemoLogos(opts.storage) : new Map<string, string>()
  const offerRows = buildOfferScenario(now, hotels)
  const surveys = buildSurveyScenario(now, hotels)
  const sent = await buildMessageScenario(now, hotels, offerRows, surveys, {
    webUrl: opts.webUrl ?? "http://localhost:3000",
    apiUrl: opts.apiUrl ?? "http://localhost:3001",
    logoKeys,
  })
  const activity = buildActivityScenario(now, hotels, offerRows, surveys, sent, opts)

  await db.transaction(async (tx) => {
    await tx.insert(user).values(scenario.users).onConflictDoNothing()
    await insertAll(tx, notes, scenario.notes)

    await insertAll(tx, user, [...hotels.users, ...activity.users])
    await insertAll(tx, account, hotels.accounts)
    await insertAll(tx, organization, [...hotels.organizations, ...activity.organizations])
    await insertAll(tx, member, hotels.members)
    await insertAll(tx, invitation, [...hotels.invitations, ...activity.invitations])
    await insertAll(tx, hotelSettings, [...hotels.hotelSettings, ...activity.hotelSettings])
    await insertAll(tx, captureSpots, hotels.captureSpots)
    for (const [hotelId, logoKey] of logoKeys)
      await tx.update(hotelSettings).set({ logoKey }).where(eq(hotelSettings.organizationId, hotelId))
    await insertAll(tx, guests, hotels.guests)
    await insertAll(tx, guestConsents, hotels.guestConsents)
    await insertAll(tx, consentEvents, hotels.consentEvents)
    await insertAll(tx, guestVisits, hotels.guestVisits)

    await insertAll(tx, offers, offerRows.offers)
    await insertAll(tx, offerCodes, offerRows.offerCodes)
    await insertAll(tx, offerRedemptions, offerRows.offerRedemptions)

    await insertAll(tx, surveyInvites, surveys.surveyInvites)
    await insertAll(tx, surveyResponses, surveys.surveyResponses)
    await insertAll(tx, feedbackCases, surveys.feedbackCases)

    await insertAll(tx, messages, sent.messages)
    await insertAll(tx, campaigns, sent.campaigns)
    await insertAll(tx, campaignRecipients, sent.campaignRecipients)
    await insertAll(tx, hotelHolidays, sent.hotelHolidays)
    await insertAll(tx, automationSends, sent.automationSends)
    await insertAll(tx, hotelBalance, sent.hotelBalance)
    await insertAll(tx, balanceLedger, sent.balanceLedger)

    await insertAll(tx, inboxItem, activity.inboxItems)
    await insertAll(tx, auditLog, activity.auditLog)
  })
  return true
}
