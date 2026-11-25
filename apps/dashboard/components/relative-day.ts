const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

/** "3 days ago" in the viewer's language. `now` comes from the server so the first render matches. */
export function relativeTime(date: Date, now: Date, locale: string): string {
  const diff = date.getTime() - now.getTime()
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  for (const [unit, size] of UNITS) {
    if (Math.abs(diff) >= size) return format.format(Math.trunc(diff / size), unit)
  }
  return format.format(0, "minute")
}
