import type { CSSProperties } from "react"

const HEX = /^#[0-9a-fA-F]{6}$/

function isLight(hex: string): boolean {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55
}

const readableOn = (hex: string) => (isLight(hex) ? "var(--foreground)" : "var(--background)")

/** A hotel's color and the theme color that reads on top of it. Anything but a #rrggbb is ignored, so the theme stays. */
export function brandColor(hex: string | null): { color: string; on: string } | null {
  return hex && HEX.test(hex) ? { color: hex, on: readableOn(hex) } : null
}

/** The theme tokens a guest page overrides with the hotel's own two colors. */
export function brandStyle(hotel: { primaryColor: string | null; accentColor: string | null }): CSSProperties {
  const primary = brandColor(hotel.primaryColor)
  const accent = brandColor(hotel.accentColor)
  return {
    "--primary": primary?.color,
    "--ring": primary?.color,
    "--primary-foreground": primary?.on,
    "--accent": accent?.color,
    "--accent-foreground": accent?.on,
  } as CSSProperties
}
