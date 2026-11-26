"use client"

import { brandContrastIssues } from "@ritorno/common/color"
import { Field, FieldDescription, FieldError, FieldLabel } from "@ritorno/ui/components/field"
import { Input } from "@ritorno/ui/components/input"
import { cn } from "@ritorno/ui/lib/utils"
import { AlertCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId } from "react"

export const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface aria-invalid:border-destructive md:text-sm"

interface Shared {
  label: string
  hint?: string
  error?: string | null
  className?: string
}

/** Label above, control, then the hint or the error with an icon. The control gets `id`, `aria-invalid` and `aria-describedby`. */
function AdminField({
  label,
  hint,
  error,
  className,
  children,
}: Shared & {
  children: (props: {
    id: string
    "aria-invalid": true | undefined
    "aria-describedby": string | undefined
  }) => React.ReactNode
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <FieldError id={`${id}-error`} className="flex items-start gap-1.5">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </FieldError>
      ) : hint ? (
        <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      ) : null}
    </Field>
  )
}

export function AdminInput({ label, hint, error, className, ...props }: Shared & React.ComponentProps<"input">) {
  return (
    <AdminField label={label} hint={hint} error={error} className={className}>
      {(aria) => <Input {...aria} {...props} />}
    </AdminField>
  )
}

export function AdminSelect({
  label,
  hint,
  error,
  className,
  options,
  ...props
}: Shared & React.ComponentProps<"select"> & { options: { value: string; label: string }[] }) {
  return (
    <AdminField label={label} hint={hint} error={error} className={className}>
      {(aria) => (
        <select {...aria} className={selectClass} {...props}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </AdminField>
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
    <AdminField label={label} error={error} hint={warning} className={className}>
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
    </AdminField>
  )
}
