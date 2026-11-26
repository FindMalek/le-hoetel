"use client"

import * as React from "react"
import { cn } from "@ritorno/ui/lib/utils"

type DialCode = { value: string; label: string }

const DIAL_CODES: DialCode[] = [
  { value: "+216", label: "TN +216" },
  { value: "+33", label: "FR +33" },
  { value: "+213", label: "DZ +213" },
  { value: "+218", label: "LY +218" },
  { value: "+212", label: "MA +212" },
  { value: "+49", label: "DE +49" },
  { value: "+44", label: "GB +44" },
  { value: "+39", label: "IT +39" },
]

type PhoneInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string
  onValueChange: (value: string) => void
  dialCode: string
  onDialCodeChange: (dialCode: string) => void
  dialCodes?: DialCode[]
  dialCodeLabel: string
}

function PhoneInput({
  className,
  value,
  onValueChange,
  dialCode,
  onDialCodeChange,
  dialCodes = DIAL_CODES,
  dialCodeLabel,
  ...props
}: PhoneInputProps) {
  return (
    <div
      data-slot="phone-input"
      dir="ltr"
      className={cn(
        "flex h-11 w-full min-w-0 items-center rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-surface has-[input[aria-invalid=true]]:border-destructive",
        className
      )}
    >
      <select
        aria-label={dialCodeLabel}
        value={dialCode}
        onChange={(event) => onDialCodeChange(event.target.value)}
        disabled={props.disabled}
        className="h-full shrink-0 rounded-s-lg border-0 border-e border-input bg-transparent ps-3 pe-2 text-base outline-none md:text-sm"
      >
        {dialCodes.map((code) => (
          <option key={code.value} value={code.value}>
            {code.label}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={value}
        onChange={(event) => onValueChange(event.target.value.replace(/[^\d\s]/g, ""))}
        className="h-full min-w-0 flex-1 rounded-e-lg bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        {...props}
      />
    </div>
  )
}

export { DIAL_CODES, PhoneInput, type DialCode, type PhoneInputProps }
