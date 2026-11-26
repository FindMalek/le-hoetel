/**
 * Every email in every language it is written in, with made-up data. Shared by the bun tests and the browser layout
 * check (`apps/e2e/tests/email.spec.ts`), which runs this file with bun and reads the JSON.
 */
import { LOCALES, type Locale } from "@ritorno/i18n/config"
import { HOTEL_EMAIL_KEYS, renderEmail, sampleGuest, sampleProps } from "../hotel-email"
import { type RenderedEmail, renderEmail as renderTemplate } from "../render"
import { getTemplate, type TemplateData, type TemplateName, templates } from "../templates"

export const HOTEL = {
  name: "Hôtel Dar Zitouna de la Médina",
  // A 1x1 png, so the browser check never touches the network.
  logoUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  primaryColor: "#0f766e",
  accentColor: "#b45309",
  address: "12 Rue de la Médina, Tunis",
}
export const UNSUBSCRIBE_URL = "https://ritorno.test/u/eyJob3RlbElkIjoiaCIsImd1ZXN0SWQiOiJnIn0.c2lnbmF0dXJl"
export const CTA_URL = "https://ritorno.test/o/1"
const APP_URL = "https://app.ritorno.test"

const ALERTS: Record<Locale, TemplateData<"alert">> = {
  en: {
    locale: "en",
    eyebrow: "Low score alert",
    title: "Low score from Sara",
    intro: "Sara left 4/10 after their stay.",
    items: [{ label: "Comment", value: "The room was noisy." }],
    url: `${APP_URL}/feedback/1`,
    cta: "Follow up",
  },
  fr: {
    locale: "fr",
    eyebrow: "Alerte note basse",
    title: "Note basse de Sara",
    intro: "Sara a mis 4/10 après son séjour.",
    items: [{ label: "Commentaire", value: "La chambre était bruyante." }],
    url: `${APP_URL}/feedback/1`,
    cta: "Traiter",
  },
  ar: {
    locale: "ar",
    eyebrow: "تنبيه تقييم منخفض",
    title: "تقييم منخفض من سارة",
    intro: "سارة قيّم 4/10 بعد الإقامة.",
    // A guest writes in whatever language they like.
    items: [{ label: "التعليق", value: "The room was noisy." }],
    url: `${APP_URL}/feedback/1`,
    cta: "للمتابعة",
  },
}

export interface Case extends RenderedEmail {
  name: string
  locale: Locale
  kind: "hotel" | "system"
}

export async function renderMatrix(): Promise<Case[]> {
  const hotel = HOTEL_EMAIL_KEYS.flatMap((key) =>
    LOCALES.map(async (locale): Promise<Case> => {
      const email = await renderEmail(key, {
        hotel: HOTEL,
        guest: sampleGuest(locale, UNSUBSCRIBE_URL),
        locale,
        props: sampleProps(key, locale, CTA_URL) as never,
      })
      return { ...email, name: key, locale, kind: "hotel" }
    }),
  )
  const system = async <Name extends TemplateName>(name: Name, locale: Locale, data: TemplateData<Name>) => ({
    ...(await renderTemplate(name, data, APP_URL)),
    name,
    locale,
    kind: "system" as const,
  })
  const localized = LOCALES.flatMap((locale) => [
    system("alert", locale, ALERTS[locale]),
    system("ownerDigest", locale, { ...(getTemplate("ownerDigest").preview as TemplateData<"ownerDigest">), locale }),
  ])
  // Account emails are English only.
  const account = (Object.keys(templates) as TemplateName[])
    .filter((name) => name !== "alert" && name !== "ownerDigest")
    .map((name) => system(name, "en", getTemplate(name).preview as never))
  return Promise.all([...hotel, ...localized, ...account])
}

if (import.meta.main) process.stdout.write(JSON.stringify(await renderMatrix()))
