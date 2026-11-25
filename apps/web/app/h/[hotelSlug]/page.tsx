import { consentWording } from "@le-hoetel/common/consent"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { CAPTURE_SOURCES } from "@le-hoetel/common/schemas"
import { getDirection, localizedPath } from "@le-hoetel/i18n"
import { GiftIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CaptureForm } from "@/components/capture-form"
import { GuestHero } from "@/components/guest-hero"
import { guestBrand } from "@/lib/branding"
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
  const t = await getTranslations({ locale: language, namespace: "capture" })
  const switchTo = (to: HotelLanguage) => {
    const next = new URLSearchParams({ src: source, lang: to })
    if (location) next.set("loc", location)
    return `?${next}`
  }

  const perk = (
    <section className="flex items-start gap-4 rounded-xl border border-brand-accent bg-brand-accent/15 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground">
        <GiftIcon aria-hidden className="size-5" />
      </span>
      <div className="grid gap-1 text-start">
        <h2 className="font-semibold">{hotel.welcomeOffer?.title ?? t("perkTitle")}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed rtl:leading-7">
          {hotel.welcomeOffer?.text || t("perkBody", { hotel: hotel.displayName })}
        </p>
      </div>
    </section>
  )

  return (
    <div
      lang={language}
      dir={getDirection(language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={guestBrand(hotel)}
      className="min-h-dvh bg-background"
    >
      <GuestHero hotel={hotel} line={t("welcome")}>
        <nav
          aria-label={t("languageLabel")}
          className="absolute end-4 top-4 flex rounded-full border bg-background/80 p-0.5 text-sm backdrop-blur-sm"
        >
          {HOTEL_LANGUAGES.map((to) => (
            <a
              key={to}
              href={switchTo(to)}
              lang={to}
              hrefLang={to}
              aria-current={to === language ? "true" : undefined}
              className="flex h-9 min-w-11 items-center justify-center rounded-full px-3 text-muted-foreground transition-colors duration-150 aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"
            >
              {LANGUAGE_NAMES[to]}
            </a>
          ))}
        </nav>
      </GuestHero>
      <main className="mx-auto flex w-full max-w-md flex-col px-5 pt-6">
        <CaptureForm
          slug={hotel.slug}
          source={source}
          location={location}
          renderedAt={Date.now()}
          language={language}
          perk={perk}
          copy={{
            name: t("name"),
            nameError: t("nameError"),
            phone: t("phone"),
            phoneError: t("phoneError"),
            dialCode: t("dialCode"),
            language: t("language"),
            optionalTitle: t("optionalTitle"),
            optionalHint: t("optionalHint"),
            birthday: t("birthday"),
            email: t("email"),
            consentTitle: t("consentTitle"),
            consentHint: t("consentHint"),
            whatsappTitle: t("whatsappTitle"),
            emailTitle: t("emailTitle"),
            emailNeeded: t("emailNeeded"),
            submit: t("submit"),
            submitHint: t("submitHint"),
            thanksTitle: t("thanksTitle", { name: "{name}" }),
            thanksBody: t("thanksBody", { hotel: hotel.displayName }),
            thanksPerk: t("thanksPerk"),
            errorInvalid: t("errorInvalid"),
            errorTooMany: t("errorTooMany"),
            whatsappWording: consentWording("whatsapp", language, hotel.displayName),
            emailWording: consentWording("email", language, hotel.displayName),
          }}
        />
      </main>
      <footer className="mx-auto flex max-w-md justify-center gap-6 px-5 py-6 text-muted-foreground text-xs">
        <a href={localizedPath(language, "/privacy")} className="flex min-h-11 items-center underline">
          {t("privacy")}
        </a>
        <a href={localizedPath(language, "/terms")} className="flex min-h-11 items-center underline">
          {t("terms")}
        </a>
      </footer>
    </div>
  )
}
