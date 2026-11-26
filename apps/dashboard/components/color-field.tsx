"use client"

import { brandContrastIssues, readableForeground } from "@ritorno/common/color"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { TriangleAlertIcon } from "lucide-react"
import { useTranslations } from "next-intl"

const HEX = /^#[0-9a-fA-F]{6}$/

export const isHexColor = (value: string): boolean => HEX.test(value)

/** A hex color with the system picker, a live sample with its readable text color, and a warning when it is too faint on the page or a surface. */
export function ColorField({
  id,
  label,
  hint,
  value,
  onChange,
  onBlur,
  error,
  fallback,
}: {
  id: string
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
  fallback: string
}) {
  const t = useTranslations("hotelSettings")
  const color = HEX.test(value) ? value : null
  const issues = brandContrastIssues(color)
  return (
    <div className="flex flex-col gap-2">
      <FormField id={id} label={label} hint={hint} error={error}>
        {(aria) => (
          <div className="flex items-center gap-2">
            <label
              className="relative grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border bg-(--swatch) focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-surface"
              // the swatch shows the color being typed
              // oxlint-disable-next-line shadcn/no-inline-styles
              style={{ "--swatch": color ?? "transparent" } as React.CSSProperties}
            >
              <span className="sr-only">{t("pickColor", { label })}</span>
              <input
                type="color"
                value={color ?? fallback}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
            <Input
              {...aria}
              name={id}
              value={value}
              onChange={(event) => onChange(event.target.value.trim())}
              onBlur={onBlur}
              placeholder={fallback}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              maxLength={7}
              className="font-mono"
            />
            {color ? (
              <span
                className="grid h-11 shrink-0 place-items-center rounded-lg bg-(--swatch) px-3 font-medium text-(--swatch-fg) text-sm"
                // oxlint-disable-next-line shadcn/no-inline-styles
                style={{ "--swatch": color, "--swatch-fg": readableForeground(color) } as React.CSSProperties}
              >
                {t("sample")}
              </span>
            ) : null}
          </div>
        )}
      </FormField>
      {issues.length > 0 ? (
        <p role="status" className="flex items-start gap-1.5 text-sm">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("contrastLight")}
        </p>
      ) : null}
    </div>
  )
}
