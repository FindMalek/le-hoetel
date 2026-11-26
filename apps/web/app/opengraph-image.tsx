import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { OG_SIZE, OgCard } from "@ritorno/ui/brand/og-card"
import { ImageResponse } from "next/og"
import { getLocale, getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"

export const alt = SITE.name
export const size = OG_SIZE
export const contentType = "image/png"

const font = (file: string) => readFile(join(process.cwd(), "assets", file))

export default async function OpengraphImage() {
  const locale = await getLocale()
  const rtl = locale === "ar"
  const t = await getTranslations({ locale, namespace: "landing.hero" })
  const [arabic, latin] = rtl ? await Promise.all([font("cairo-arabic-700.woff"), font("cairo-latin-700.woff")]) : []
  return new ImageResponse(
    <OgCard
      title={rtl ? t("title") : SITE.name}
      description={rtl ? undefined : t("title")}
      colors={SITE.og}
      rtl={rtl}
    />,
    {
      ...size,
      fonts:
        arabic && latin
          ? [
              { name: "Cairo", data: arabic, weight: 700, style: "normal" },
              { name: "Cairo", data: latin, weight: 700, style: "normal" },
            ]
          : undefined,
    },
  )
}
