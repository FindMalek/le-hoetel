"use client"

import { Field, FieldDescription, FieldError, FieldLabel } from "@ritorno/ui/components/field"
import { AlertCircleIcon } from "lucide-react"
import { useId } from "react"

type FormFieldControlProps = {
  id: string
  "aria-invalid": boolean
  "aria-describedby": string | undefined
}

type FormFieldProps = {
  id?: string
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode | null
  /** Shows the required marker. The control still needs its own `required`. */
  required?: boolean
  /** Muted text after the label, e.g. "(optional)". */
  optional?: React.ReactNode
  className?: string
  children: (props: FormFieldControlProps) => React.ReactNode
}

/** Label above any control, then its hint or an inline error that is announced and linked through `aria-describedby`. */
function FormField({ id, label, hint, error, required, optional, className, children }: FormFieldProps) {
  const fallbackId = useId()
  const controlId = id ?? fallbackId
  const describedBy =
    [error ? `${controlId}-error` : null, hint && !error ? `${controlId}-hint` : null].filter(Boolean).join(" ") ||
    undefined
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={controlId}>
        {label}
        {required ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : null}
        {optional ? <span className="font-normal text-muted-foreground">{optional}</span> : null}
      </FieldLabel>
      {children({ id: controlId, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error ? <FieldDescription id={`${controlId}-hint`}>{hint}</FieldDescription> : null}
      {error ? (
        <FieldError id={`${controlId}-error`} className="flex items-start gap-1.5">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </FieldError>
      ) : null}
    </Field>
  )
}

export { FormField, type FormFieldControlProps }
