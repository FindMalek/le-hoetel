import { consentWording } from "@ritorno/common/consent"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { CAPTURE_SOURCES } from "@ritorno/common/schemas"
import { GiftIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CaptureForm } from "@/components/capture-form"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { getPublicHotel } from "@/lib/capture"

type Props = { params: Promise<{ hotelSlug: string }>; searchParams: Promise<Record<string, string | undefined>> }

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function CapturePage({ params, searchParams }: Props) {
  const [{ hotelSlug }, query] = await Promise.all([params, searchParams])
  const hotel = await getPublicHotel(hotelSlug)
  if (!hotel) notFound()

  const language = guestLanguage(query.lang, hotel.defaultLanguage)
  const source = query.src && query.src in CAPTURE_SOURCES ? query.src : "desk"
  const location = (query.loc ?? "").slice(0, 40)
  const t = await getTranslations({ locale: language, namespace: "capture" })
  const switchTo = (to: HotelLanguage) => {
    const next = new URLSearchParams({ src: source, lang: to })
    if (location) next.set("loc", location)
    return `?${next}`
  }

  const perk = (
    <section className="flex items-start gap-4 rounded-card border border-brand-accent bg-brand-accent/15 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground">
        <GiftIcon aria-hidden className="size-5" />
      </span>
      <div className="grid gap-1 text-start">
        <h2 className="font-semibold">{hotel.welcomeOffer?.title ?? t("perkTitle")}</h2>
        <p className="text-foreground/80 text-sm leading-relaxed rtl:leading-7">
          {hotel.welcomeOffer?.text || t("perkBody", { hotel: hotel.displayName })}
        </p>
      </div>
    </section>
  )

  return (
    <GuestShell hotel={hotel} language={language} line={t("welcome")} languageHref={switchTo}>
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
    </GuestShell>
  )
}
