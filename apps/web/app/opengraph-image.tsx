import { OG_SIZE, OgCard } from "@le-hoetel/ui/brand/og-card"
import { ImageResponse } from "next/og"
import { getLocale, getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"

export const alt = SITE.name
export const size = OG_SIZE
export const contentType = "image/png"

/** The default OG font has no Arabic glyphs, so the Arabic card uses the English line and the page's og:title carries the Arabic. */
export default async function OpengraphImage() {
  const locale = await getLocale()
  const t = await getTranslations({ locale: locale === "ar" ? "en" : locale, namespace: "landing.hero" })
  return new ImageResponse(
    <OgCard name={SITE.name} title={SITE.name} description={t("title")} colors={SITE.og} />,
    size,
  )
}
