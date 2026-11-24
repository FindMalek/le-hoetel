const HEX = /^#[0-9a-fA-F]{6}$/

/** Black or white, whichever reads on `hex`. */
function readableOn(hex: string): string {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#000000" : "#ffffff"
}

/** A hotel color and the text color that reads on it, or undefined for anything that is not `#rrggbb`. */
export function brandColor(hex: string | null): { color: string; on: string } | undefined {
  return hex && HEX.test(hex) ? { color: hex, on: readableOn(hex) } : undefined
}
