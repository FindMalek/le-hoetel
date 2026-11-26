"use client"

import { brandContrastIssues } from "@ritorno/common/color"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { Select } from "@ritorno/ui/components/select"
import { cn } from "@ritorno/ui/lib/utils"
import { useTranslations } from "next-intl"

interface Shared {
  label: string
  hint?: string
  error?: string | null
  className?: string
  required?: boolean
}

export function AdminInput({
  label,
  hint,
  error,
  className,
  required,
  ...props
}: Shared & React.ComponentProps<"input">) {
  return (
    <FormField label={label} hint={hint} error={error} className={className} required={required}>
      {(aria) => <Input {...aria} required={required} {...props} />}
    </FormField>
  )
}

export function AdminSelect<V extends string>({
  label,
  hint,
  error,
  className,
  ...props
}: Shared & Omit<React.ComponentProps<typeof Select<V>>, "className">) {
  return (
    <FormField label={label} hint={hint} error={error} className={className}>
      {(aria) => <Select {...aria} {...props} />}
    </FormField>
  )
}

const HEX = /^#[0-9a-fA-F]{6}$/

export const isHex = (value: string) => HEX.test(value)

/** A hex input with a native picker next to it and a warning when the color is too faint on the page or a surface. */
export function ColorInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  className,
}: Shared & { value: string; onChange: (value: string) => void; placeholder: string }) {
  const t = useTranslations("adminHotel")
  const issues = brandContrastIssues(isHex(value) ? value : null)
  const warning = issues.length > 0 ? t("contrastLight") : undefined
  return (
    <FormField label={label} error={error} hint={warning} className={className}>
      {(aria) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={label}
            value={isHex(value) ? value : "#000000"}
            onChange={(event) => onChange(event.target.value)}
            className={cn("size-11 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1")}
          />
          <Input
            {...aria}
            value={value}
            onChange={(event) => onChange(event.target.value.trim())}
            placeholder={placeholder}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
    </FormField>
  )
}
