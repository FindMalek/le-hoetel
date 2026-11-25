import type { Locale } from "@ritorno/i18n/config"
import { ar } from "./ar"
import type { Copy } from "./en"
import { en } from "./en"
import { fr } from "./fr"

export type { Copy }

export const COPY: Record<Locale, Copy> = { en, fr, ar }

const FIRST_STRONG_ISOLATE = "\u2068"
const POP_ISOLATE = "\u2069"

/** Fills `{key}` placeholders. In right to left copy the values are isolated so a Latin name can't reorder the sentence. */
export function fill(text: string, values: Record<string, string>, rtl: boolean): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key]
    if (value === undefined) return match
    return rtl ? `${FIRST_STRONG_ISOLATE}${value}${POP_ISOLATE}` : value
  })
}
