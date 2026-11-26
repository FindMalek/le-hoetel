import { type CampaignContent, type CampaignSegment, EMPTY_SEGMENT } from "@ritorno/common/campaigns"
import type { campaigns } from "../schema"

type NewCampaign = typeof campaigns.$inferInsert

export interface CampaignDef {
  name: string
  channel: NewCampaign["channel"]
  status: NonNullable<NewCampaign["status"]>
  /** Days before now it went (or was due) out; negative is in the future, null for a draft. */
  daysAgo: number | null
  segment: CampaignSegment
  /** Promo code of the offer it carries. */
  offer: string | null
  content: Required<CampaignContent>
}

const text = (en: [string, string], fr: [string, string], ar: [string, string]): Required<CampaignContent> => ({
  en: { subject: en[0], body: en[1] },
  fr: { subject: fr[0], body: fr[1] },
  ar: { subject: ar[0], body: ar[1] },
})

export const CAMPAIGNS: CampaignDef[] = [
  {
    name: "Summer evenings on the terrace",
    channel: "both",
    status: "sent",
    daysAgo: 118,
    segment: EMPTY_SEGMENT,
    offer: "SUNSET2",
    content: text(
      ["Summer evenings at {hotel}", "Our terrace is open until late. Come back and enjoy two cocktails for one."],
      [
        "Les soirées d'été à {hotel}",
        "La terrasse est ouverte tard le soir. Revenez profiter de deux cocktails pour un.",
      ],
      ["أمسيات الصيف في {hotel}", "السطح مفتوح حتى وقت متأخر. عودوا واستمتعوا بمشروبين بسعر واحد."],
    ),
  },
  {
    name: "Autumn spa weekend",
    channel: "whatsapp",
    status: "sent",
    daysAgo: 26,
    segment: { ...EMPTY_SEGMENT, languages: ["fr", "ar"] },
    offer: "SPA10",
    content: text(
      ["An autumn weekend", "Book a weekend in November and the spa is 10 TND off."],
      ["Un week-end d'automne", "Réservez un week-end en novembre et profitez de 10 TND de remise au spa."],
      ["عطلة نهاية أسبوع خريفية", "احجزوا عطلة في نوفمبر واحصلوا على خصم 10 دنانير في السبا."],
    ),
  },
  {
    name: "Winter sun for European guests",
    channel: "email",
    status: "sent",
    daysAgo: 5,
    segment: { ...EMPTY_SEGMENT, countries: ["France", "Germany", "United Kingdom", "Italy"] },
    offer: null,
    content: text(
      ["22 degrees in December at {hotel}", "Winter in Tunisia is mild and quiet. We kept the sea view rooms for you."],
      ["22 degrés en décembre à {hotel}", "L'hiver tunisien est doux et calme. Les chambres vue mer vous attendent."],
      ["22 درجة في ديسمبر في {hotel}", "الشتاء في تونس لطيف وهادئ. غرف البحر في انتظاركم."],
    ),
  },
  {
    name: "New Year's Eve dinner",
    channel: "both",
    status: "scheduled",
    daysAgo: -6,
    segment: EMPTY_SEGMENT,
    offer: null,
    content: text(
      ["New Year's Eve at {hotel}", "A five course dinner and live music on 31 December. Reply to book your table."],
      ["Réveillon à {hotel}", "Dîner en cinq services et musique live le 31 décembre. Répondez pour réserver."],
      ["ليلة رأس السنة في {hotel}", "عشاء من خمسة أطباق وموسيقى حية يوم 31 ديسمبر. ردوا علينا للحجز."],
    ),
  },
  {
    name: "Spring school holidays",
    channel: "email",
    status: "draft",
    daysAgo: null,
    segment: { ...EMPTY_SEGMENT, lastVisitDays: 180 },
    offer: null,
    content: text(
      ["Spring holidays with the family", "Children stay free during the spring school break."],
      [
        "Les vacances de printemps en famille",
        "Les enfants séjournent gratuitement pendant les vacances de printemps.",
      ],
      ["عطلة الربيع مع العائلة", "إقامة مجانية للأطفال خلال عطلة الربيع."],
    ),
  },
  {
    name: "Flash spa Tuesday",
    channel: "whatsapp",
    status: "cancelled",
    daysAgo: 40,
    segment: { ...EMPTY_SEGMENT, sources: ["qr_room"] },
    offer: "SPA10",
    content: text(
      ["Spa Tuesday", "Today only, half price massages."],
      ["Mardi spa", "Aujourd'hui seulement, massages à moitié prix."],
      ["ثلاثاء السبا", "اليوم فقط، التدليك بنصف السعر."],
    ),
  },
]
