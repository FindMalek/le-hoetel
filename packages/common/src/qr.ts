import { CAPTURE_LOCATION_MAX, type CaptureSource } from "./schemas/capture"

export const QR_SPOTS_MAX = 100

/**
 * What a manager types for one kind of spot: names or numbers split by commas or lines, and number ranges
 * (`101-120`). Blank entries and repeats are dropped, and at most `QR_SPOTS_MAX` are kept.
 */
export function parseSpots(input: string): string[] {
  const spots = new Set<string>()
  for (const raw of input.split(/[,\n]/)) {
    const entry = raw.trim().slice(0, CAPTURE_LOCATION_MAX)
    const range = /^(\d{1,5})\s*-\s*(\d{1,5})$/.exec(entry)
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])]
      for (let n = from; n <= to && spots.size < QR_SPOTS_MAX; n++) spots.add(String(n))
    } else if (entry) spots.add(entry)
    if (spots.size >= QR_SPOTS_MAX) break
  }
  return [...spots].slice(0, QR_SPOTS_MAX)
}

/** The page a QR code opens. The spot is optional: a front desk code often has none. */
export function captureUrl(webUrl: string, slug: string, source: CaptureSource, location?: string | null): string {
  const query = new URLSearchParams({ src: source })
  if (location) query.set("loc", location)
  return `${webUrl.replace(/\/$/, "")}/h/${encodeURIComponent(slug)}?${query}`
}
