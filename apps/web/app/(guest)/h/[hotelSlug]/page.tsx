import { consentWording } from "@ritorno/common/consent"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { CAPTURE_SOURCES, type CaptureSource } from "@ritorno/common/schemas"
import { matchLocale } from "@ritorno/i18n"
import { buttonVariants } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { cn } from "@ritorno/ui/lib/utils"
import { GiftIcon, MessageCircleIcon } from "lucide-react"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CaptureForm } from "@/components/capture-form"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { getPublicHotel, getWhatsAppLink } from "@/lib/capture"

type Props = { params: Promise<{ hotelSlug: string }>; searchParams: Promise<Record<string, string | undefined>> }

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function CapturePage({ params, searchParams }: Props) {
  const [{ hotelSlug }, query] = await Promise.all([params, searchParams])
  const hotel = await getPublicHotel(hotelSlug)
  if (!hotel) notFound()

  // `?lang`, then the phone's languages, then the hotel's: it is also the language of the guest's messages
  const phoneLanguage = matchLocale((await headers()).get("accept-language"))
  const language = guestLanguage(query.lang, phoneLanguage ?? hotel.defaultLanguage)
  const source = (query.src && query.src in CAPTURE_SOURCES ? query.src : "desk") as CaptureSource
  const location = (query.loc ?? "").slice(0, 40)
  // the hotel's own try-out from the QR page: it shows everything and sends nothing
  const preview = query.preview === "1"
  const [t, tPicker, offerCopy] = await Promise.all([
    getTranslations({ locale: language, namespace: "capture" }),
    getTranslations({ locale: language, namespace: "countryPicker" }),
    getTranslations({ locale: language, namespace: "offer" }),
  ])
  const whatsappUrl = preview
    ? null
    : await getWhatsAppLink({ slug: hotel.slug, source, language, location: location || null })
  const switchTo = (to: HotelLanguage) => {
    const next = new URLSearchParams({ src: source, lang: to })
    if (location) next.set("loc", location)
    if (preview) next.set("preview", "1")
    return `?${next}`
  }

  const perk = (
    <section className="flex items-start gap-3 rounded-card border border-brand-accent bg-brand-accent/15 p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground">
        <GiftIcon aria-hidden className="size-4" />
      </span>
      <div className="grid text-start">
        <h2 className="font-semibold text-sm">
          <bdi>{hotel.welcomeOffer?.title ?? t("perkTitle")}</bdi>
        </h2>
        <p className="text-foreground/80 text-sm rtl:leading-6">
          <bdi>{hotel.welcomeOffer?.text || t("perkBody", { hotel: hotel.displayName })}</bdi>
        </p>
      </div>
    </section>
  )

  const whatsapp = whatsappUrl ? (
    <section className="grid w-full gap-2">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "min-h-11 w-full")}
      >
        <MessageCircleIcon data-icon="inline-start" aria-hidden />
        {t("whatsappButton")}
      </a>
      <p className="text-center text-muted-foreground text-xs leading-relaxed rtl:text-[0.8125rem]">
        {t("whatsappHint", { hotel: hotel.displayName })}
      </p>
    </section>
  ) : null

  return (
    <GuestShell compact hotel={hotel} language={language} line={t("welcome")} languageHref={switchTo}>
      {preview ? (
        <InlineAlert tone="info" title={t("previewTitle")} className="mb-6">
          {t("previewBody")}
        </InlineAlert>
      ) : null}
      <CaptureForm
        preview={preview}
        slug={hotel.slug}
        source={source}
        location={location}
        language={language}
        perk={perk}
        whatsapp={whatsapp}
        copy={{
          name: t("name"),
          nameError: t("nameError"),
          phone: t("phone"),
          phoneError: t("phoneError"),
          countryPicker: {
            label: tPicker("label"),
            search: tPicker("search"),
            empty: tPicker("empty"),
            close: tPicker("close"),
          },
          departure: {
            title: t("departure"),
            optional: t("departureOptional"),
            nights: [
              { nights: 1, label: t("departureTomorrow") },
              ...[2, 3, 7].map((nights) => ({ nights, label: t("departureNights", { count: nights }) })),
            ],
            pick: t("departurePick"),
            date: t("departureDate"),
            dateError: t("departureDateError"),
            keep: t("departureKeep"),
            wording: consentWording("profile", language, hotel.displayName),
          },
          optionalTitle: t("optionalTitle"),
          optionalHint: t("optionalHint"),
          birthday: t("birthday"),
          email: t("email"),
          emailError: t("emailError"),
          birthdayError: t("birthdayError"),
          whatsappError: t("whatsappError"),
          consentTitle: t("consentTitle"),
          consentHint: t("consentHint"),
          whatsappTitle: t("whatsappTitle"),
          emailTitle: t("emailTitle"),
          emailNeeded: t("emailNeeded"),
          submit: t("submit"),
          sending: t("sending"),
          submitHint: t("submitHint"),
          thanksTitle: t("thanksTitle", { name: "{name}" }),
          thanksBody: t("thanksBody", { hotel: hotel.displayName }),
          thanksPerk: t("thanksPerk"),
          signUpPerk: {
            code: offerCopy("code"),
            // `{code}` stays in the text: the code is only known once the guest has signed up.
            qrAlt: offerCopy("qrAlt", { code: "{code}" }),
            validFrom: offerCopy("validFrom", { from: "{from}" }),
            validBetween: offerCopy("validBetween", { from: "{from}", until: "{until}" }),
            show: t("perkShow"),
            save: t("perkSave"),
            open: t("perkOpen"),
            returning: t("perkReturning"),
          },
          errorInvalid: t("errorInvalid"),
          errorTooMany: t("errorTooMany"),
          errorFailed: t("errorFailed"),
          whatsappWording: consentWording("whatsapp", language, hotel.displayName),
          emailWording: consentWording("email", language, hotel.displayName),
        }}
      />
    </GuestShell>
  )
}
