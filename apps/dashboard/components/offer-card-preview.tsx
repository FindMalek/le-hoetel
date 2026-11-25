"use client"

import { brandStyle } from "@le-hoetel/common/color"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { Tabs, TabsList, TabsTrigger } from "@le-hoetel/ui/components/tabs"
import { useTranslations } from "next-intl"
import { useState } from "react"

export interface OfferPreviewCopy {
  ready: string
  code: string
  show: string
  validFrom: string
  validBetween: string
}
export type OfferPreviewCopies = Record<HotelLanguage, OfferPreviewCopy>

export interface OfferPreviewHotel {
  name: string
  logoSrc: string | null
  primaryColor: string | null
  accentColor: string | null
  language: HotelLanguage
}

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")

const SAMPLE_CODE = "AB3D-EF7H"

/** The offer page as the guest opens it, in the hotel's colors and in the language picked here, with a sample code in place of a real QR. */
export function OfferCardPreview({
  hotel,
  offer,
  copies,
}: {
  hotel: OfferPreviewHotel
  offer: { title: string; text: string; validFrom: Date | null; validUntil: Date | null }
  copies: OfferPreviewCopies
}) {
  const t = useTranslations("offers.preview")
  const [language, setLanguage] = useState<HotelLanguage>(hotel.language)
  const copy = copies[language]
  const day = new Intl.DateTimeFormat(language, { dateStyle: "long", timeZone: "Africa/Tunis" })
  const from = offer.validFrom ? day.format(offer.validFrom) : null
  const until = offer.validUntil ? day.format(offer.validUntil) : null
  return (
    <section aria-labelledby="offer-preview-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="offer-preview-title" className="font-heading font-semibold text-base">
          {t("title")}
        </h2>
        <Tabs value={language} onValueChange={(next) => setLanguage(next as HotelLanguage)}>
          <TabsList>
            {HOTEL_LANGUAGES.map((value) => (
              <TabsTrigger key={value} value={value} aria-label={LOCALE_NAMES[value]}>
                {value.toUpperCase()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div
        lang={language}
        dir={language === "ar" ? "rtl" : "ltr"}
        // the preview wears the hotel's colors the way the guest page does
        // oxlint-disable-next-line shadcn/no-inline-styles
        style={brandStyle(hotel)}
        className="mx-auto w-full max-w-xs rounded-2xl bg-muted/50 p-4"
      >
        <div aria-hidden className="flex flex-col gap-4 overflow-hidden rounded-3xl border bg-background p-5 shadow-sm">
          {hotel.logoSrc ? (
            // biome-ignore lint/performance/noImgElement: a hotel upload behind the dashboard's file proxy
            <img src={hotel.logoSrc} alt="" className="h-10 w-auto self-start object-contain" />
          ) : (
            <p className="font-medium text-muted-foreground text-sm">{hotel.name}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <p className="text-balance break-words font-heading font-semibold text-xl leading-tight tracking-tight">
              {offer.title || t("titlePlaceholder")}
            </p>
            {offer.text ? <p className="text-pretty break-words text-muted-foreground text-sm">{offer.text}</p> : null}
          </div>
          <p className="rounded-lg bg-brand-accent px-3 py-2 text-brand-accent-foreground text-sm">{copy.ready}</p>
          <div className="mx-auto grid aspect-square w-36 place-items-center rounded-lg border-2 border-primary border-dashed">
            <span className="font-medium text-primary text-xs">QR</span>
          </div>
          <p className="text-center">
            <span className="block text-muted-foreground text-xs">{copy.code}</span>
            <bdi dir="ltr" className="font-mono font-semibold text-lg tracking-widest">
              {SAMPLE_CODE}
            </bdi>
          </p>
          <p className="text-center text-muted-foreground text-xs">{copy.show}</p>
          {from ? (
            <p className="text-center text-muted-foreground text-xs">
              {until ? fill(copy.validBetween, { from, until }) : fill(copy.validFrom, { from })}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-pretty text-muted-foreground text-sm">{t("hint")}</p>
    </section>
  )
}
