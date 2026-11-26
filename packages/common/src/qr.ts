import { CAPTURE_LOCATION_MAX, type CaptureSource } from "./schemas/capture"

export const QR_SPOTS_MAX = 100
/** Rooms and tables one hotel can save. */
export const HOTEL_SPOTS_MAX = 500
/** The logo's white pad as a share of the code's width. Covers about 5% of it, and error level H recovers 30%. */
export const QR_LOGO_RATIO = 0.22

/** The tiny label printed by a code so staff know where it goes: `383` for a room, `T4` for table 4. */
export const staffLabel = (source: CaptureSource, location: string | null): string | null =>
  location && source === "table" && /^\d+$/.test(location) ? `T${location}` : location

/**
 * What a manager types for one kind of spot: names or numbers split by commas or lines, and number ranges
 * (`101-120`, `120-101` reads the same). Blank entries and repeats are dropped, and at most `QR_SPOTS_MAX` are kept:
 * `cut` says some were left out.
 */
export function parseSpots(input: string): { spots: string[]; cut: boolean } {
  const spots = new Set<string>()
  const full = (spot: string) => {
    if (spots.size >= QR_SPOTS_MAX && !spots.has(spot)) return true
    spots.add(spot)
    return false
  }
  for (const raw of input.split(/[,\n]/)) {
    const entry = raw.trim().slice(0, CAPTURE_LOCATION_MAX)
    const range = /^(\d{1,5})\s*-\s*(\d{1,5})$/.exec(entry)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])]
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) {
        if (full(String(n))) return { spots: [...spots], cut: true }
      }
    } else if (entry && full(entry)) return { spots: [...spots], cut: true }
  }
  return { spots: [...spots], cut: false }
}

/** The download name of one code. Letters of any script stay, so two Arabic spots never share a file. */
export const qrFileName = (source: CaptureSource, location: string | null, ext: string): string =>
  `qr-${source}${location ? `-${location.replace(/[^\p{L}\p{M}\p{N}-]+/gu, "_")}` : ""}.${ext}`

/** The page a QR code opens. The spot is optional: a front desk code often has none. */
export function captureUrl(webUrl: string, slug: string, source: CaptureSource, location?: string | null): string {
  const query = new URLSearchParams({ src: source })
  if (location) query.set("loc", location)
  return `${webUrl.replace(/\/$/, "")}/h/${encodeURIComponent(slug)}?${query}`
}
