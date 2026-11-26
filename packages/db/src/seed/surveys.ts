import { SURVEY_HOURS_AFTER_STAY, SURVEY_INVITE_DAYS } from "@ritorno/common/survey"
import type { feedbackCases, surveyInvites, surveyResponses } from "../schema"
import { BAD_COMMENTS, CASE_NOTES, GOOD_COMMENTS, NEUTRAL_COMMENTS } from "./comments"
import type { HotelScenario } from "./hotels"
import { DAY, dice, earlier, HOUR } from "./random"

type NewInvite = typeof surveyInvites.$inferInsert
type NewCase = typeof feedbackCases.$inferInsert
type NewResponse = typeof surveyResponses.$inferInsert

export interface SurveyScenario {
  surveyInvites: NewInvite[]
  surveyResponses: NewResponse[]
  feedbackCases: NewCase[]
}

const SCORES = [10, 10, 10, 10, 10, 9, 9, 9, 9, 9, 9, 8, 8, 8, 7, 7, 6, 5, 4, 2]

/** An unhappy answer this recent still waits for someone. */
const UNTOUCHED_DAYS = 6

/**
 * Every guest whose stay is over and who accepts a message has an invite, so the hourly survey job finds nobody left
 * from the seed. About four in ten answered, most of them happy; each unhappy answer opens a feedback case.
 */
export function buildSurveyScenario(now: Date, hotels: HotelScenario, seed = 20261126): SurveyScenario {
  const { rand, int, pick, chance, uuid } = dice(seed)
  const out: SurveyScenario = { surveyInvites: [], surveyResponses: [], feedbackCases: [] }
  const reachable = new Set(
    hotels.guestConsents.filter((c) => c.granted && c.channel !== "profile").map((c) => c.guestId),
  )
  for (const guest of hotels.guests) {
    if (!reachable.has(guest.id!)) continue
    // The same rule as the job: a day after noon of check-out, else a day after the capture.
    if (guest.source === "csv" && !guest.stayCheckOut) continue
    const left = guest.stayCheckOut ? new Date(`${guest.stayCheckOut}T11:00:00Z`) : guest.createdAt!
    const sentAt = new Date(left.getTime() + SURVEY_HOURS_AFTER_STAY * HOUR)
    if (sentAt >= now) continue
    const inviteId = uuid()
    out.surveyInvites.push({
      id: inviteId,
      hotelId: guest.hotelId,
      guestId: guest.id!,
      sentAt,
      expiresAt: new Date(sentAt.getTime() + SURVEY_INVITE_DAYS * DAY),
      createdAt: sentAt,
    })
    const submittedAt = new Date(sentAt.getTime() + HOUR / 3 + rand() * 3 * DAY)
    if (submittedAt >= now || !chance(0.4)) continue
    const nps = pick(SCORES)
    const stars = (base: number) => Math.max(1, Math.min(5, base + int(2) - (chance(0.2) ? 1 : 0)))
    const base = nps >= 7 ? 4 : 2
    const words = nps <= 6 ? BAD_COMMENTS : nps <= 8 && chance(0.5) ? NEUTRAL_COMMENTS : GOOD_COMMENTS
    const responseId = uuid()
    out.surveyResponses.push({
      id: responseId,
      hotelId: guest.hotelId,
      guestId: guest.id!,
      inviteId,
      nps,
      ratingRooms: chance(0.8) ? stars(base) : null,
      ratingCleanliness: chance(0.8) ? stars(base) : null,
      ratingService: chance(0.7) ? stars(base) : null,
      comment: nps <= 6 || chance(0.55) ? pick(words[guest.language]) : null,
      language: guest.language,
      submittedAt,
      reviewLinkClickedAt: nps >= 9 && chance(0.35) ? earlier(now, new Date(+submittedAt + HOUR / 4)) : null,
    })
    if (nps > 6) continue
    const age = (now.getTime() - submittedAt.getTime()) / DAY
    const status =
      age < UNTOUCHED_DAYS ? "new" : age < 20 ? pick(["new", "contacted", "resolved"] as const) : "resolved"
    const language = hotels.hotelSettings.find((h) => h.organizationId === guest.hotelId)!.defaultLanguage!
    const team = hotels.members.filter((m) => m.organizationId === guest.hotelId && m.role !== "staff")
    const handledAt = earlier(now, new Date(submittedAt.getTime() + (2 + int(40)) * HOUR))
    out.feedbackCases.push({
      id: uuid(),
      hotelId: guest.hotelId,
      responseId,
      status,
      notes: status === "new" ? null : pick(CASE_NOTES[status][language]),
      handledBy: status === "new" ? null : pick(team).userId,
      createdAt: submittedAt,
      updatedAt: status === "new" ? submittedAt : handledAt,
    })
  }
  return out
}
