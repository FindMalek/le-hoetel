import { consentWording } from "@le-hoetel/common/consent"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { CAPTURE_SOURCES } from "@le-hoetel/common/schemas"
import { getDirection, localizedPath } from "@le-hoetel/i18n"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import type { CSSProperties } from "react"
import { CaptureForm } from "@/components/capture-form"
import { brandColor } from "@/lib/branding"
import { getPublicHotel } from "@/lib/capture"

type Props = { params: Promise<{ hotelSlug: string }>; searchParams: Promise<Record<string, string | undefined>> }

const LANGUAGE_NAMES: Record<HotelLanguage, string> = { en: "English", fr: "Français", ar: "العربية" }

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function CapturePage({ params, searchParams }: Props) {
  const [{ hotelSlug }, query] = await Promise.all([params, searchParams])
  const hotel = await getPublicHotel(hotelSlug)
  if (!hotel) notFound()

  const language = HOTEL_LANGUAGES.find((l) => l === query.lang) ?? hotel.defaultLanguage
  const source = query.src && query.src in CAPTURE_SOURCES ? query.src : "desk"
  const location = (query.loc ?? "").slice(0, 40)
  const primary = brandColor(hotel.primaryColor)
  const accent = brandColor(hotel.accentColor)
  const t = await getTranslations({ locale: language, namespace: "capture" })
  const withHotel = (text: string) => text.replaceAll("{hotel}", hotel.displayName)
  const switchTo = (to: HotelLanguage) => {
    const next = new URLSearchParams({ src: source, lang: to })
    if (location) next.set("loc", location)
    return `?${next}`
  }

  return (
    <div
      lang={language}
      dir={getDirection(language)}
      style={
        {
          "--primary": primary?.color,
          "--ring": primary?.color,
          "--primary-foreground": primary?.on,
          "--accent": accent?.color,
          "--accent-foreground": accent?.on,
        } as CSSProperties
      }
    >
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-8">
        <nav aria-label={t("languageLabel")} className="flex justify-end gap-3 text-sm">
          {HOTEL_LANGUAGES.map((to) => (
            <a
              key={to}
              href={switchTo(to)}
              lang={to}
              aria-current={to === language ? "true" : undefined}
              className={to === language ? "font-semibold text-primary" : "text-muted-foreground"}
            >
              {LANGUAGE_NAMES[to]}
            </a>
          ))}
        </nav>
        <header>
          <h1 className="font-heading font-semibold text-2xl">{withHotel(t("welcome"))}</h1>
          <p className="mt-2 text-muted-foreground">{t("intro")}</p>
        </header>
        <section className="border bg-accent p-4 text-accent-foreground">
          <h2 className="font-medium">{t("perkTitle")}</h2>
          <p className="mt-1 text-sm">{withHotel(t("perkBody"))}</p>
        </section>
        <CaptureForm
          slug={hotel.slug}
          source={source}
          location={location}
          renderedAt={Date.now()}
          language={language}
          copy={{
            name: t("name"),
            phone: t("phone"),
            dialCode: t("dialCode"),
            language: t("language"),
            birthday: t("birthday"),
            email: t("email"),
            consentTitle: t("consentTitle"),
            consentHint: t("consentHint"),
            emailNeeded: t("emailNeeded"),
            submit: t("submit"),
            sending: t("sending"),
            thanksTitle: t("thanksTitle"),
            errorInvalid: t("errorInvalid"),
            errorTooMany: t("errorTooMany"),
            thanksBody: withHotel(t("thanksBody")),
            whatsappWording: consentWording("whatsapp", language, hotel.displayName),
            emailWording: consentWording("email", language, hotel.displayName),
          }}
        />
        <footer className="text-center text-muted-foreground text-xs">
          <a href={localizedPath(language, "/privacy")} className="underline">
            {t("privacy")}
          </a>
        </footer>
      </main>
    </div>
  )
}
