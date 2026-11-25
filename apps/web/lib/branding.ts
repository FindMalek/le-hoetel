import { brandStyle } from "@ritorno/common/color"
import type { CSSProperties } from "react"

/** The hotel's two colors as theme tokens for a guest page. The focus ring follows the primary color. */
export function guestBrand(hotel: { primaryColor: string | null; accentColor: string | null }): CSSProperties {
  const style = brandStyle(hotel)
  if (style["--primary"]) style["--ring"] = style["--primary"]
  return style as CSSProperties
}
