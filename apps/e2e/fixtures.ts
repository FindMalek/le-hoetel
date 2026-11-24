import { expect, type Page } from "@playwright/test"
import { URLS } from "./env"

export const LOCALES = ["en", "fr", "ar"] as const
export type Locale = (typeof LOCALES)[number]

const DIRECTION: Record<Locale, "ltr" | "rtl"> = { en: "ltr", fr: "ltr", ar: "rtl" }

/** The public site is `/` for English and `/fr`, `/ar` for the others. */
export const webUrl = (locale: Locale) => (locale === "en" ? URLS.web : `${URLS.web}/${locale}`)

/** The language, the writing direction and no sideways scroll: what breaks first on a phone or in Arabic. */
export async function expectLocaleLayout(page: Page, locale: Locale) {
  const html = page.locator("html")
  await expect(html).toHaveAttribute("lang", locale)
  await expect(html).toHaveAttribute("dir", DIRECTION[locale])
  await expect(page.locator("body")).toHaveCSS("direction", DIRECTION[locale])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}
