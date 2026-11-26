import { Link } from "@react-email/components"
import type { Locale } from "@ritorno/i18n/config"
import { BRAND } from "../brand"
import { defineTemplate } from "./define"
import { Box, CtaButton, Label, Layout, Paragraph, Rows, Title } from "./primitives"

export interface DigestStat {
  current: number
  previous: number
}

export interface OwnerDigestData {
  locale: Locale
  hotel: string
  /** First and last day of the week reported, `YYYY-MM-DD` in hotel time. */
  from: string
  to: string
  /** Counts only: the digest never names a guest. */
  newGuests: DigestStat
  returningGuests: DigestStat
  messagesSent: DigestStat
  offersRedeemed: DigestStat
  surveyResponses: DigestStat
  /** Average of the week's survey scores out of 10, null without an answer. */
  score: number | null
  /** Low score cases nobody has picked up yet. */
  openCases: number
  url: string
  settingsUrl: string
}

const COPY = {
  en: {
    eyebrow: "Weekly summary",
    title: "Your week at {hotel}",
    period: "{from} to {to}.",
    quiet: "A quiet week. Put your QR codes where guests will see them: front desk, rooms, tables.",
    newGuests: "New guests",
    returningGuests: "Returning guests",
    messagesSent: "Messages sent",
    offersRedeemed: "Offers redeemed",
    surveyResponses: "Survey answers",
    score: "Average score",
    openCases: "Unhappy guests waiting for you",
    previous: "{current} (week before: {previous})",
    cta: "Open your dashboard",
    reason: "You get this weekly summary because you own {hotel} on {brand}.",
    optOut: "Turn off the weekly summary",
  },
  fr: {
    eyebrow: "Résumé de la semaine",
    title: "Votre semaine à {hotel}",
    period: "Du {from} au {to}.",
    quiet: "Semaine calme. Placez vos QR codes là où les clients les voient : réception, chambres, tables.",
    newGuests: "Nouveaux clients",
    returningGuests: "Clients revenus",
    messagesSent: "Messages envoyés",
    offersRedeemed: "Offres utilisées",
    surveyResponses: "Réponses à l’enquête",
    score: "Note moyenne",
    openCases: "Clients mécontents à recontacter",
    previous: "{current} (semaine d’avant : {previous})",
    cta: "Ouvrir votre tableau de bord",
    reason: "Vous recevez ce résumé parce que vous êtes propriétaire de {hotel} sur {brand}.",
    optOut: "Désactiver le résumé hebdomadaire",
  },
  ar: {
    eyebrow: "الملخص الأسبوعي",
    title: "أسبوعكم في {hotel}",
    period: "من {from} إلى {to}.",
    quiet: "أسبوع هادئ. ضعوا رموز QR حيث يراها النزلاء: الاستقبال والغرف والطاولات.",
    newGuests: "نزلاء جدد",
    returningGuests: "نزلاء عائدون",
    messagesSent: "رسائل مرسلة",
    offersRedeemed: "عروض مستعملة",
    surveyResponses: "إجابات الاستبيان",
    score: "متوسط التقييم",
    openCases: "نزلاء غير راضين بانتظار متابعتكم",
    previous: "{current} (الأسبوع السابق: {previous})",
    cta: "افتحوا لوحة التحكم",
    reason: "يصلكم هذا الملخص لأنكم مالكو {hotel} على {brand}.",
    optOut: "إيقاف الملخص الأسبوعي",
  },
} satisfies Record<Locale, Record<string, string>>

const STATS = ["newGuests", "returningGuests", "messagesSent", "offersRedeemed", "surveyResponses"] as const

/** Isolates a value so a Latin name or a number doesn't reorder an Arabic sentence. */
const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => `\u2068${values[key]}\u2069`)

const day = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  )

function words(data: OwnerDigestData) {
  const { locale, hotel } = data
  const copy = COPY[locale]
  const quiet = !data.openCases && STATS.every((key) => data[key].current === 0)
  const period = fill(copy.period, { from: day(data.from, locale), to: day(data.to, locale) })
  const items = [
    ...(data.openCases ? [{ label: copy.openCases, value: String(data.openCases) }] : []),
    ...STATS.map((key) => ({ label: copy[key], value: fill(copy.previous, { ...data[key] }) })),
    ...(data.score === null ? [] : [{ label: copy.score, value: `\u2066${data.score}/10\u2069` }]),
  ]
  return {
    copy,
    title: fill(copy.title, { hotel }),
    intro: quiet ? `${period} ${copy.quiet}` : period,
    items,
    reason: fill(copy.reason, { hotel, brand: BRAND.name }),
  }
}

export const ownerDigest = defineTemplate<OwnerDigestData>({
  subject: (data) => words(data).title,
  summary: (data) => {
    const { title, intro, items, copy } = words(data)
    return {
      title,
      lines: [intro, ...items.map((item) => `${item.label}: ${item.value}`)],
      link: { label: copy.cta, url: data.url },
    }
  },
  preview: {
    locale: "en",
    hotel: "Dar Zarrouk",
    from: "2026-11-16",
    to: "2026-11-22",
    newGuests: { current: 18, previous: 11 },
    returningGuests: { current: 4, previous: 2 },
    messagesSent: { current: 46, previous: 39 },
    offersRedeemed: { current: 7, previous: 5 },
    surveyResponses: { current: 9, previous: 6 },
    score: 8.6,
    openCases: 1,
    url: "https://app.example.com",
    settingsUrl: "https://app.example.com/hotel?hotel=hotel-id#weekly-digest",
  },
  Email: ({ appUrl, ...data }) => {
    const { copy, title, intro, items, reason } = words(data)
    return (
      <Layout
        preview={intro}
        appUrl={appUrl}
        locale={data.locale}
        footer={
          <>
            {reason}{" "}
            <Link href={data.settingsUrl} className="e-mut" style={{ color: "inherit", textDecoration: "underline" }}>
              {copy.optOut}
            </Link>
          </>
        }
      >
        <Box>
          <Label>{copy.eyebrow}</Label>
          <Title>{title}</Title>
          <Paragraph>{intro}</Paragraph>
          <Rows rows={items} />
          <CtaButton href={data.url}>{copy.cta}</CtaButton>
        </Box>
      </Layout>
    )
  },
})
