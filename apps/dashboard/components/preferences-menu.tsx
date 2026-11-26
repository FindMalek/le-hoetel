"use client"

import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES, type Locale } from "@ritorno/i18n"
import {
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@ritorno/ui/components/dropdown-menu"
import { useLocale, useTranslations } from "next-intl"

export const setLocale = (locale: string) => {
  // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in some browsers
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
  window.location.reload()
}

/** Language as a radio group, to drop inside any dropdown menu content. */
export function PreferencesMenu() {
  const t = useTranslations("shell")
  const locale = useLocale() as Locale
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={locale} onValueChange={(value) => value !== locale && setLocale(value)}>
        {LOCALES.map((value) => (
          <DropdownMenuRadioItem key={value} value={value} className="coarse:min-h-11">
            {LOCALE_NAMES[value]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  )
}
