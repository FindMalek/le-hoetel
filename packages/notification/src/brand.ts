export interface BrandColors {
  /** The page around the card. */
  canvas: string
  background: string
  foreground: string
  muted: string
  border: string
  surface: string
  primary: string
  primaryForeground: string
  /** Small blue text: eyebrows and links. */
  link: string
}

/**
 * The look of every email, from the Ritorno tokens in `packages/ui/src/styles/theme.css`. Web fonts are unreliable in
 * mail, so each stack names the brand font for the few clients that have it, then falls back to system faces.
 */
export const BRAND = {
  name: "Ritorno",
  /** Cards; buttons are always pills. */
  radius: 20,
  fontSans: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  /** The italic display line; Georgia italic is the fallback every client has. */
  fontDisplay: "Newsreader, Georgia, 'Times New Roman', serif",
  fontArabic: "'Noto Sans Arabic', 'Geeza Pro', Tahoma, Arial, sans-serif",
  /** Arabic display stays upright, no fake slant. */
  fontArabicDisplay: "'Noto Naskh Arabic', 'Geeza Pro', 'Traditional Arabic', Tahoma, serif",
  fontMono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  light: {
    canvas: "#f4f4f3",
    background: "#ffffff",
    foreground: "#0b0b0c",
    muted: "#6b6b70",
    border: "#e4e4e2",
    surface: "#f4f4f3",
    primary: "#0b0b0c",
    primaryForeground: "#ffffff",
    link: "#0059c2",
  } satisfies BrandColors,
  /** Only for clients that honor `prefers-color-scheme`; the rest keep the light colors or invert them on their own. */
  dark: {
    canvas: "#0b0b0c",
    background: "#161618",
    foreground: "#f4f4f3",
    muted: "#a1a1a6",
    border: "#2c2c2e",
    surface: "#1f1f21",
    primary: "#f4f4f3",
    primaryForeground: "#0b0b0c",
    link: "#84bfff",
  } satisfies BrandColors,
}

export type Brand = typeof BRAND

/** Sans and display stacks for a text direction. */
export const brandFonts = (rtl: boolean): { sans: string; display: string } =>
  rtl
    ? { sans: BRAND.fontArabic, display: BRAND.fontArabicDisplay }
    : { sans: BRAND.fontSans, display: BRAND.fontDisplay }
