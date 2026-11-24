"use client"

import { GUEST_SOURCES } from "@le-hoetel/common/consent"
import { GUEST_CONSENT_FILTERS } from "@le-hoetel/common/schemas"
import { LOCALE_NAMES, LOCALES } from "@le-hoetel/i18n"
import { Button } from "@le-hoetel/ui/components/button"
import { Input } from "@le-hoetel/ui/components/input"
import { Label } from "@le-hoetel/ui/components/label"
import { useTranslations } from "next-intl"

export interface GuestFilterValues {
  q?: string
  consent?: string
  source?: string
  language?: string
}

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

function Choice({
  name,
  label,
  any,
  value,
  options,
}: {
  name: string
  label: string
  any: string
  value?: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`guest-${name}`}>{label}</Label>
      <select
        id={`guest-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className={selectClass}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="">{any}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A plain GET form: the url holds the filters, so a search can be shared and survives a refresh. */
export function GuestFilters({ values }: { values: GuestFilterValues }) {
  const t = useTranslations("guests")
  const active = Boolean(values.q || values.consent || values.source || values.language)
  return (
    <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
        <Label htmlFor="guest-q">{t("search")}</Label>
        <Input id="guest-q" name="q" type="search" defaultValue={values.q ?? ""} enterKeyHint="search" />
      </div>
      <Choice
        name="consent"
        label={t("filter.consent")}
        any={t("filter.any")}
        value={values.consent}
        options={GUEST_CONSENT_FILTERS.map((value) => ({ value, label: t(`consent.${value}`) }))}
      />
      <Choice
        name="source"
        label={t("filter.source")}
        any={t("filter.any")}
        value={values.source}
        options={GUEST_SOURCES.map((value) => ({ value, label: t(`source.${value}`) }))}
      />
      <Choice
        name="language"
        label={t("filter.language")}
        any={t("filter.any")}
        value={values.language}
        options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      />
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" className="h-11 flex-1">
          {t("apply")}
        </Button>
        {active && (
          <Button variant="outline" className="h-11" render={<a href="?" />} nativeButton={false}>
            {t("reset")}
          </Button>
        )}
      </div>
    </form>
  )
}
