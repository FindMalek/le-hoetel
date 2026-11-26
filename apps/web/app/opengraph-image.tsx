import { loadOgFonts, OG_SIZE, OgCard } from "@ritorno/ui/brand/og-card"
import { ImageResponse } from "next/og"
import { getLocale, getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"

export const alt = SITE.name
export const size = OG_SIZE
export const contentType = "image/png"

export default async function OpengraphImage() {
  const locale = await getLocale()
  const rtl = locale === "ar"
  const t = await getTranslations({ locale, namespace: "landing.hero" })
  return new ImageResponse(
    <OgCard title={t("title")} description={rtl ? undefined : SITE.tagline} colors={SITE.og} rtl={rtl} />,
    { ...size, fonts: await loadOgFonts(rtl) },
  )
}
