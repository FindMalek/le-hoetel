"use client"

import { LOCALE_NAMES, LOCALES, type Locale } from "@le-hoetel/i18n"
import { Button } from "@le-hoetel/ui/components/button"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { setLocale } from "@/components/preferences-menu"

const THEMES = [
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
  { value: "system", icon: MonitorIcon },
] as const

function Choice({ legend, hint, children }: { legend: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-medium text-sm">{legend}</legend>
      <div className="grid grid-cols-3 gap-2">{children}</div>
      {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
    </fieldset>
  )
}

/** Language and theme as two rows of buttons: one tap, no menu to open. */
export function PreferencesSection() {
  const t = useTranslations("shell")
  const tLanguage = useTranslations("language")
  const locale = useLocale() as Locale
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const current = mounted ? (theme ?? "system") : null
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
      <Choice legend={t("theme")}>
        {THEMES.map(({ value, icon: Icon }) => (
          <Button
            key={value}
            variant={current === value ? "secondary" : "outline"}
            aria-pressed={current === value}
            className={current === value ? "border-primary" : undefined}
            onClick={() => setTheme(value)}
          >
            <Icon data-icon="inline-start" />
            {t(value)}
          </Button>
        ))}
      </Choice>
    </div>
  )
}
