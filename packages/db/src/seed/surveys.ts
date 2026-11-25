import type { feedbackCases, surveyInvites, surveyResponses } from "../schema"
import type { HotelScenario } from "./hotels"
import { random } from "./random"

const DAY = 864e5

type NewInvite = typeof surveyInvites.$inferInsert
type NewCase = typeof feedbackCases.$inferInsert
type NewResponse = typeof surveyResponses.$inferInsert
type Language = NewResponse["language"]

export interface SurveyScenario {
  surveyInvites: NewInvite[]
  surveyResponses: NewResponse[]
  feedbackCases: NewCase[]
}

const GOOD: Record<Language, string[]> = {
  fr: [
    "Séjour parfait, le personnel est adorable.",
    "Chambre très propre et petit-déjeuner généreux.",
    "Vue magnifique, nous reviendrons en famille.",
    "Accueil chaleureux, merci à toute l'équipe.",
  ],
  ar: [
    "إقامة رائعة والطاقم لطيف جدًا.",
    "الغرفة نظيفة والفطور ممتاز.",
    "المنظر جميل وسنعود مع العائلة.",
    "استقبال دافئ، شكرًا لكل الفريق.",
  ],
  en: [
    "Perfect stay, the staff were lovely.",
    "Spotless room and a generous breakfast.",
    "Beautiful view, we will be back with the family.",
    "Warm welcome, thank you to the whole team.",
  ],
}

const BAD: Record<Language, string[]> = {
  fr: [
    "Le climatiseur de la chambre ne marchait pas la nuit.",
    "Attente trop longue à la réception à l'arrivée.",
    "Bruit dans le couloir jusqu'à tard.",
    "Salle de bain pas assez propre à notre arrivée.",
  ],
  ar: [
    "المكيف في الغرفة لم يكن يعمل ليلًا.",
    "انتظرنا طويلًا في الاستقبال عند الوصول.",
    "كان هناك ضجيج في الممر حتى وقت متأخر.",
    "الحمام لم يكن نظيفًا بما يكفي عند وصولنا.",
  ],
  en: [
    "The air conditioning did not work at night.",
    "Too long a wait at the front desk on arrival.",
    "Noise in the corridor until late.",
    "The bathroom was not clean enough when we arrived.",
  ],
}

const SCORES = [10, 10, 10, 10, 9, 9, 9, 9, 8, 8, 8, 7, 7, 6, 5, 4, 3]

/** About one guest in five answered a survey in the last 60 days, most of them happy, a few not. Same seed, same answers. */
export function buildSurveyScenario(now: Date, hotels: HotelScenario, seed = 20261126): SurveyScenario {
  const rand = random(seed)
  const int = (max: number) => Math.floor(rand() * max)
  const hex = (n: number) => Array.from({ length: n }, () => int(16).toString(16)).join("")
  const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[int(4)]}${hex(3)}-${hex(12)}`
  const out: SurveyScenario = { surveyInvites: [], surveyResponses: [], feedbackCases: [] }
  hotels.guests.forEach((guest, index) => {
    if (index % 5 !== 0) return
    const sentAt = new Date(now.getTime() - (1 + int(60)) * DAY)
    const id = uuid()
    out.surveyInvites.push({
      id,
      hotelId: guest.hotelId,
      guestId: guest.id!,
      sentAt,
      expiresAt: new Date(sentAt.getTime() + 14 * DAY),
      createdAt: sentAt,
    })
    if (rand() < 0.3) return
    const nps = SCORES[int(SCORES.length)]!
    const stars = (base: number) => Math.max(1, Math.min(5, base + int(2) - (rand() < 0.2 ? 1 : 0)))
    const base = nps >= 9 ? 4 : nps >= 7 ? 4 : 2
    const words = nps <= 6 ? BAD : GOOD
    const responseId = uuid()
    out.surveyResponses.push({
      id: responseId,
      hotelId: guest.hotelId,
      guestId: guest.id!,
      inviteId: id,
      nps,
      ratingRooms: rand() < 0.8 ? stars(base) : null,
      ratingCleanliness: rand() < 0.8 ? stars(base) : null,
      ratingService: rand() < 0.6 ? stars(base) : null,
      comment: rand() < 0.6 ? words[guest.language]![int(4)]! : null,
      language: guest.language,
      submittedAt: new Date(sentAt.getTime() + int(3 * DAY)),
    })
    if (nps <= 6) {
      const status = (["new", "new", "contacted", "resolved"] as const)[int(4)]!
      out.feedbackCases.push({ hotelId: guest.hotelId, responseId, status, createdAt: sentAt, updatedAt: sentAt })
    }
  })
  return out
}
