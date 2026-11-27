"use client"

import { dialCodeOf, type PhoneValue, readPhone, toInternational } from "@ritorno/common/dial"
import type { CountryPickerProps } from "@ritorno/ui/components/country-picker"
import { cn } from "@ritorno/ui/lib/utils"
import { ChevronDownIcon } from "lucide-react"
import * as React from "react"

// read through `tPicker` by the callers, which the key check cannot follow. i18n-used: countryPicker.
type CountryPickerCopy = { label: string; search: string; empty: string; close: string }

/** State of a phone field. */
function usePhoneNumber() {
  // never preselected from the browser: a local number under a foreign code can be a real stranger's number
  const [value, setValue] = React.useState<PhoneValue>({ country: "TN", national: "" })
  return { value, setValue, number: toInternational(value) }
}

type PhoneInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: PhoneValue
  onValueChange: (value: PhoneValue) => void
  /** Language of the country names. */
  locale: string
  copy: CountryPickerCopy
}

// The list of 245 countries is only fetched when someone opens it: the capture page has a script budget.
const loadPicker = () => import("@ritorno/ui/components/country-picker")

function PhoneInput({ className, value, onValueChange, locale, copy, ...props }: PhoneInputProps) {
  const box = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [Picker, setPicker] = React.useState<React.ComponentType<CountryPickerProps> | null>(null)

  const countryName = new Intl.DisplayNames([locale], { type: "region" }).of(value.country)

  function openPicker() {
    setOpen(true)
    // offline the list stays closed, typing `+` and the code still switches the country
    loadPicker().then(
      (module) => setPicker(() => module.CountryPicker),
      () => setOpen(false),
    )
  }

  return (
    <div
      ref={box}
      data-slot="phone-input"
      dir="ltr"
      className={cn(
        "flex h-11 w-full min-w-0 items-center rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-surface has-[input[aria-invalid=true]]:border-destructive",
        className,
      )}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${copy.label}: ${value.country} +${dialCodeOf(value.country)}, ${countryName}`}
        // server and browser can word a country name differently
        suppressHydrationWarning
        disabled={props.disabled}
        onPointerEnter={() => void loadPicker().catch(() => {})}
        onClick={openPicker}
        className="flex h-full min-h-11 min-w-11 shrink-0 items-center gap-1 rounded-s-lg border-e border-input ps-3 pe-2 text-base tabular-nums outline-none focus-visible:bg-muted disabled:opacity-50 md:text-sm"
      >
        {value.country} +{dialCodeOf(value.country)}
        <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
      </button>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value.national}
        onChange={(event) => onValueChange(readPhone(event.target.value, value))}
        className="h-full min-w-0 flex-1 rounded-e-lg bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        {...props}
      />
      {Picker ? (
        <Picker
          open={open}
          onOpenChange={setOpen}
          country={value.country}
          onSelect={(country) => {
            onValueChange({ country, national: value.national })
            setOpen(false)
          }}
          locale={locale}
          copy={copy}
          finalFocus={() => box.current?.querySelector("input") ?? null}
        />
      ) : null}
    </div>
  )
}

export { type CountryPickerCopy, PhoneInput, type PhoneInputProps, usePhoneNumber }
