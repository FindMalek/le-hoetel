import type {} from "next-intl"
import type { Locale } from "./config"
import ar from "./messages/ar.json"
import en from "./messages/en.json"
import fr from "./messages/fr.json"

export * from "./config"

/** The shape of `messages/en.json`. `t("...")` is checked against it. */
export type Messages = typeof en

type Tree = { [key: string]: string | Tree }

const MESSAGES: Record<Locale, Tree> = { en, fr, ar }

/** `base` with every string `override` has on top, so a key missing from a translation shows the English one. */
export function withFallback(base: Tree, override: Tree | undefined): Tree {
  const merged: Tree = {}
  for (const [key, value] of Object.entries(base)) {
    const other = override?.[key]
    if (typeof value === "string") merged[key] = typeof other === "string" ? other : value
    else merged[key] = withFallback(value, typeof other === "object" ? other : undefined)
  }
  return merged
}

export const getMessages = (locale: Locale): Messages => withFallback(en, MESSAGES[locale]) as Messages

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale
    Messages: Messages
  }
}
