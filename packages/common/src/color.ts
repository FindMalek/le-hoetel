const HEX = /^#[0-9a-fA-F]{6}$/

/** The page backgrounds of `packages/ui/src/styles/theme.css`, as sRGB hex, for contrast checks. */
export const PAGE_BACKGROUNDS = { light: "#ffffff", dark: "#09090b" } as const

/** WCAG 1.4.11: user interface components and graphics need 3:1 against what is behind them. */
export const MIN_UI_CONTRAST = 3

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0)
}

/** WCAG contrast ratio between two `#rrggbb` colors, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

/** Black or white, whichever reads better on `background`. Always at least 4.5:1 (WCAG AA text). */
export function readableForeground(background: string): "#000000" | "#ffffff" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#000000") ? "#ffffff" : "#000000"
}

/** The themes where a brand color is too faint to be seen as a button, border or icon on the page. */
export function brandContrastIssues(color: string | null | undefined): ("light" | "dark")[] {
  if (!color || !HEX.test(color)) return []
  return (["light", "dark"] as const).filter((mode) => contrastRatio(color, PAGE_BACKGROUNDS[mode]) < MIN_UI_CONTRAST)
}

/** The css variables that rebrand a hotel's pages: primary and one accent, each with a readable foreground. */
export function brandStyle(brand: { primaryColor: string | null; accentColor: string | null }): Record<string, string> {
  const style: Record<string, string> = {}
  if (brand.primaryColor && HEX.test(brand.primaryColor)) {
    style["--primary"] = brand.primaryColor
    style["--primary-foreground"] = readableForeground(brand.primaryColor)
  }
  if (brand.accentColor && HEX.test(brand.accentColor)) {
    style["--brand-accent"] = brand.accentColor
    style["--brand-accent-foreground"] = readableForeground(brand.accentColor)
  }
  return style
}
