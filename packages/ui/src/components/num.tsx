import { formatNumber } from "@ritorno/ui/lib/number"

type NumProps = {
  value: number | string
  /** Formats a number with `formatNumber`. Without it a number is printed as is. */
  locale?: string
  options?: Intl.NumberFormatOptions
  className?: string
}

/** A number isolated left to right, so signs and percents never flip inside an Arabic sentence. */
function Num({ value, locale, options, className }: NumProps) {
  const text = typeof value === "number" && locale ? formatNumber(value, locale, options) : String(value)
  return (
    <bdi dir="ltr" className={className}>
      {text}
    </bdi>
  )
}

export { Num }
