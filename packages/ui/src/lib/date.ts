/**
 * A day with the month spelled out in the locale ("Nov 26, 2026", "26 nov. 2026", "26 نوفمبر 2026"), Western digits
 * in every language. Not `dateStyle: "medium"`: in Arabic that is all digits.
 */
export function formatDate(value: Date, locale: string, timeZone?: string): string {
  if (Number.isNaN(value.getTime())) return ""
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    numberingSystem: "latn",
    timeZone,
  }).format(value)
}
