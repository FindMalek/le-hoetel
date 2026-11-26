"use client"

import { useLocale } from "next-intl"

/**
 * A date in the app's language and the viewer's own timezone. The server can't know the timezone, so the text may
 * differ from the server render; suppressHydrationWarning accepts that for this one node.
 */
export function LocalDate({ value, time = false }: { value: Date; time?: boolean }) {
  const locale = useLocale()
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    ...(time ? { timeStyle: "short" } : {}),
    numberingSystem: "latn",
  }
  return (
    <time dateTime={value.toISOString()} suppressHydrationWarning>
      {new Intl.DateTimeFormat(locale, options).format(value)}
    </time>
  )
}
