"use client"

import { LOCALE_NAMES, LOCALES, type Locale } from "@ritorno/i18n"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { useLocale, useTranslations } from "next-intl"
import { setLocale } from "@/components/preferences-menu"

/** Language as a row of segments: one tap, no menu to open. */
export function PreferencesSection() {
  const t = useTranslations("shell")
  const tLanguage = useTranslations("language")
  const locale = useLocale() as Locale
  return (
    <div className="flex flex-col gap-2">
      <span className="font-medium text-sm">{t("language")}</span>
      <SegmentedControl
        label={t("language")}
        block
        value={locale}
        onValueChange={(value) => value !== locale && setLocale(value)}
        options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      />
      <p className="text-muted-foreground text-sm">{tLanguage("description")}</p>
    </div>
  )
}
