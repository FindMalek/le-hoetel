import { loadOgFonts, OG_SIZE, OgCard } from "@ritorno/ui/brand/og-card"
import { ImageResponse } from "next/og"
import { SITE } from "@/lib/site"

export const alt = `${SITE.name} docs`
export const size = OG_SIZE
export const contentType = "image/png"

export default async function OpengraphImage() {
  return new ImageResponse(<OgCard suffix="docs" title="Documentation" description={SITE.tagline} colors={SITE.og} />, {
    ...size,
    fonts: await loadOgFonts(),
  })
}
