/** Numbers in the locale's grouping and decimal marks, Western digits in every language (Arabic included). */
export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, { numberingSystem: "latn", ...options }).format(value)
}

/** A change with its sign, "+12%" or "-3", zero without one. */
export function formatDelta(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return formatNumber(value, locale, { signDisplay: "exceptZero", ...options })
}
