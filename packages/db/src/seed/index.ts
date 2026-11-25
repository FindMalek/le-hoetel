import { DEFAULT_DEMO_PASSWORD } from "@ritorno/common/demo"
import { count } from "drizzle-orm"
import type { Db } from "../index"
import {
  account,
  consentEvents,
  feedbackCases,
  guestConsents,
  guests,
  hotelSettings,
  member,
  notes,
  offerCodes,
  offerRedemptions,
  offers,
  organization,
  surveyInvites,
  surveyResponses,
  user,
} from "../schema"
import { buildHotelScenario } from "./hotels"
import { buildOfferScenario } from "./offers"
import { buildScenario } from "./scenario"
import { buildSurveyScenario } from "./surveys"

export { buildHotelScenario } from "./hotels"
export { buildOfferScenario } from "./offers"
export { buildScenario } from "./scenario"
export { buildSurveyScenario } from "./surveys"

export interface SeedOptions {
  ownerId?: string
  /** The demo accounts share one password; pass the auth library's hasher so they can sign in. */
  hashPassword: (password: string) => Promise<string>
  demoPassword?: string
}

/**
 * Writes the demo into an empty database only, so it never touches real data. One section per feature: a later
 * feature appends its own insert after the hotels and guests (stays, offers, campaigns, messages, surveys, alerts).
 */
export async function seedDemo(db: Db, opts: SeedOptions): Promise<boolean> {
  const [existingNotes] = await db.select({ n: count() }).from(notes)
  const [existingHotels] = await db.select({ n: count() }).from(organization)
  if ((existingNotes?.n ?? 0) + (existingHotels?.n ?? 0) > 0) return false
  const now = new Date()
  const scenario = buildScenario(now, opts)
  const hotels = buildHotelScenario(now, await opts.hashPassword(opts.demoPassword || DEFAULT_DEMO_PASSWORD))
  const offerRows = buildOfferScenario(now, hotels)
  const surveyRows = buildSurveyScenario(now, hotels)
  await db.transaction(async (tx) => {
    await tx.insert(user).values(scenario.users).onConflictDoNothing()
    await tx.insert(notes).values(scenario.notes)

    await tx.insert(user).values(hotels.users)
    await tx.insert(account).values(hotels.accounts)
    await tx.insert(organization).values(hotels.organizations)
    await tx.insert(member).values(hotels.members)
    await tx.insert(hotelSettings).values(hotels.hotelSettings)
    await tx.insert(guests).values(hotels.guests)
    await tx.insert(guestConsents).values(hotels.guestConsents)
    await tx.insert(consentEvents).values(hotels.consentEvents)

    await tx.insert(offers).values(offerRows.offers)
    await tx.insert(offerCodes).values(offerRows.offerCodes)
    await tx.insert(offerRedemptions).values(offerRows.offerRedemptions)

    await tx.insert(surveyInvites).values(surveyRows.surveyInvites)
    await tx.insert(surveyResponses).values(surveyRows.surveyResponses)
    if (surveyRows.feedbackCases.length) await tx.insert(feedbackCases).values(surveyRows.feedbackCases)
  })
  return true
}
