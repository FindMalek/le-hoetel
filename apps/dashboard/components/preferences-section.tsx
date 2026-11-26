"use client"

import { LOCALE_NAMES, LOCALES, type Locale } from "@ritorno/i18n"
import { Button } from "@ritorno/ui/components/button"
import { useLocale, useTranslations } from "next-intl"
import { setLocale } from "@/components/preferences-menu"

function Choice({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">{children}</div>
      {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
    </fieldset>
  )
}

/** Language as a row of buttons: one tap, no menu to open. */
export function PreferencesSection() {
  const t = useTranslations("shell")
  const tLanguage = useTranslations("language")
  const locale = useLocale() as Locale
  return (
    <div className="flex flex-col gap-6">
      <Choice legend={t("language")} hint={tLanguage("description")}>
        {LOCALES.map((value) => (
          <Button
            key={value}
            variant={locale === value ? "secondary" : "outline"}
            aria-pressed={locale === value}
            className={locale === value ? "border-primary" : undefined}
            onClick={() => value !== locale && setLocale(value)}
          >
            {LOCALE_NAMES[value]}
          </Button>
        ))}
      </Choice>
    </div>
  )
}
