"use client"

import { DIAL_COUNTRIES, matchesCountry } from "@ritorno/common/dial"
import { Button } from "@ritorno/ui/components/button"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@ritorno/ui/components/command"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@ritorno/ui/components/dialog"
import type { CountryPickerCopy } from "@ritorno/ui/components/phone-input"
import { cn } from "@ritorno/ui/lib/utils"
import { CheckIcon, XIcon } from "lucide-react"
import * as React from "react"

type CountryPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  country: string
  onSelect: (country: string) => void
  locale: string
  copy: CountryPickerCopy
  finalFocus: () => HTMLElement | null
}

function countryList(locale: string) {
  const local = new Intl.DisplayNames([locale], { type: "region" })
  const english = new Intl.DisplayNames(["en"], { type: "region" })
  return DIAL_COUNTRIES.map(({ country, code }) => ({
    country,
    code,
    name: local.of(country) ?? country,
    names: [local.of(country) ?? country, english.of(country) ?? country],
  })).sort((a, b) => a.name.localeCompare(b.name, locale))
}

function CountryPicker({ open, onOpenChange, country, onSelect, locale, copy, finalFocus }: CountryPickerProps) {
  const [query, setQuery] = React.useState("")
  const countries = React.useMemo(() => countryList(locale), [locale])
  const found = countries.filter((item) => matchesCountry(item, query))

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setQuery("")
        onOpenChange(next)
      }}
    >
      {/* near the top so the phone keyboard doesn't cover the results */}
      <DialogContent
        dir={locale === "ar" ? "rtl" : "ltr"}
        lang={locale}
        showCloseButton={false}
        finalFocus={finalFocus}
        className="top-4 translate-y-0 gap-0 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b ps-4 pe-1">
          <DialogTitle>{copy.label}</DialogTitle>
          <DialogClose render={<Button variant="ghost" size="icon" className="size-11" aria-label={copy.close} />}>
            <XIcon aria-hidden />
          </DialogClose>
        </div>
        <Command shouldFilter={false} label={copy.search} defaultValue={country}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={copy.search} className="h-11 text-base" />
          <CommandList className="max-h-[min(20rem,50dvh)] p-1">
            <CommandEmpty>{copy.empty}</CommandEmpty>
            {found.map((item) => (
              <CommandItem
                key={item.country}
                value={item.country}
                onSelect={() => onSelect(item.country)}
                className="min-h-11 text-base md:text-sm"
              >
                <CheckIcon aria-hidden className={cn(item.country !== country && "invisible")} />
                <span className="min-w-0 flex-1 text-start">{item.name}</span>
                <span dir="ltr" className="text-muted-foreground tabular-nums">
                  +{item.code}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export { CountryPicker, type CountryPickerProps }
