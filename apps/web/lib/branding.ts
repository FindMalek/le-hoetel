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
