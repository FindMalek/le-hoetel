import { brandContrastIssues, brandStyle } from "@ritorno/common/color"
import type { CSSProperties } from "react"

/** The hotel's two colors as theme tokens for a guest page. The focus ring follows the primary color, unless it is too faint to see on the page: then it stays ink. */
export function guestBrand(hotel: { primaryColor: string | null; accentColor: string | null }): CSSProperties {
  const style = brandStyle(hotel)
  if (style["--primary"] && brandContrastIssues(hotel.primaryColor).length === 0) style["--ring"] = style["--primary"]
  return style as CSSProperties
}
