"use client"

import { brandContrastIssues, readableForeground } from "@ritorno/common/color"
import { Field, FieldDescription, FieldLabel } from "@ritorno/ui/components/field"
import { Input } from "@ritorno/ui/components/input"
import { useState } from "react"

export interface ColorLabels {
  sample: string
  contrastLight: string
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** A hex color input with a live sample (readable text color included) and a warning when the color is too faint on the page or a surface. */
export function ColorInput({
  name,
  label,
  placeholder,
  defaultValue,
  labels,
}: {
  name: string
  label: string
  placeholder: string
  defaultValue?: string | null
  labels: ColorLabels
}) {
  const [value, setValue] = useState(defaultValue ?? "")
  const color = HEX.test(value) ? value : null
  const issues = brandContrastIssues(color)
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          id={name}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value.trim())}
          placeholder={placeholder}
          pattern="#[0-9a-fA-F]{6}"
          dir="ltr"
          aria-invalid={issues.length > 0 || undefined}
        />
        {color && (
          <span
            className="grid h-9 shrink-0 place-items-center border bg-(--sample) px-3 text-(--sample-fg) text-xs"
            style={{ "--sample": color, "--sample-fg": readableForeground(color) } as React.CSSProperties}
          >
            {labels.sample}
          </span>
        )}
      </div>
      {issues.length > 0 && <FieldDescription role="alert">{labels.contrastLight}</FieldDescription>}
    </Field>
  )
}
