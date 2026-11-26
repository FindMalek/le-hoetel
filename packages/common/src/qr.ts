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

/** No `0 O 1 I L`: the code is also read off paper and typed by hand. No vowels, so no code spells a word. */
const SHORT_ALPHABET = "23456789BCDFGHJKMNPQRSTVWXYZ"
/** Long enough that guessing codes to list hotels is hopeless under the rate limit. */
const SHORT_LENGTH = 8

export const newShortCode = (): string =>
  Array.from(
    crypto.getRandomValues(new Uint32Array(SHORT_LENGTH)),
    (n) => SHORT_ALPHABET[n % SHORT_ALPHABET.length],
  ).join("")

/** Someone typing the address by hand need not use capitals. */
export const normalizeShortCode = (code: string): string => code.trim().toUpperCase()

export const shortUrl = (webUrl: string, code: string): string => `${webUrl.replace(/\/$/, "")}/q/${code}`

/** The address as printed under a code: what someone types when the camera fails. */
export const printedUrl = (url: string): string => url.replace(/^https?:\/\//, "")

/** A downloaded code: the same svg made taller, with the address written under it. */
export function captionedSvg(svg: string, caption: string): string {
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1])
  // a monospace letter is 0.6 em wide: a long host shrinks the line instead of leaving the code
  const font = Math.min(size * 0.08, (size * 0.94) / (caption.length * 0.6))
  const height = size + font * 1.6
  return svg
    .replace(
      /viewBox="[^"]*"([^>]*)>/,
      `viewBox="0 0 ${size} ${height}" width="1024" height="${Math.round((1024 * height) / size)}"$1><rect width="${size}" height="${height}" fill="#fff"/>`,
    )
    .replace(
      "</svg>",
      `<text x="${size / 2}" y="${size + font * 0.8}" font-family="monospace" font-size="${font}" text-anchor="middle" shape-rendering="auto">${caption.replaceAll("&", "&amp;")}</text></svg>`,
    )
}
