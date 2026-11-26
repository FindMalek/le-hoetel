import { cn } from "@ritorno/ui/lib/utils"
import { useId } from "react"

type SegmentedOption<V extends string> = {
  value: V
  label: React.ReactNode
  /** With an href on every option the control renders links, for pickers that live in the url (period on a server page). */
  href?: string
}

type SegmentedControlProps<V extends string> = {
  /** Accessible name of the group. */
  label: string
  options: readonly SegmentedOption<V>[]
  value?: V
  defaultValue?: V
  onValueChange?: (value: V) => void
  /** Radio name, so the choice posts with a plain form. */
  name?: string
  /** Stretch the segments to the full width (forms on a phone). */
  block?: boolean
  disabled?: boolean
  /** Link component for href options, e.g. Next `Link`. */
  linkComponent?: React.ElementType
  className?: string
}

const GROUP = "relative inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1"
const SEGMENT =
  "inline-flex h-9 flex-1 cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 font-medium sm:px-4 text-muted-foreground text-sm transition-colors duration-150 hover:text-foreground coarse:h-11"
const SELECTED = "bg-background text-foreground shadow-xs"

/**
 * One choice out of a few, always visible. Native radios underneath, so arrow keys, forms and screen readers work
 * without script. Use a `Select` past five options.
 */
function SegmentedControl<V extends string>({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  block,
  disabled,
  linkComponent: LinkComponent = "a",
  className,
}: SegmentedControlProps<V>) {
  const fallbackName = useId()
  const groupClass = cn(GROUP, block && "flex w-full", disabled && "opacity-50", className)

  if (options.every((option) => option.href)) {
    return (
      <nav aria-label={label} className={groupClass}>
        {options.map((option) => (
          <LinkComponent
            key={option.value}
            href={option.href}
            aria-current={option.value === value ? "page" : undefined}
            className={cn(SEGMENT, option.value === value && SELECTED, "outline-none focus-visible:ring-2 focus-visible:ring-ring")}
          >
            {option.label}
          </LinkComponent>
        ))}
      </nav>
    )
  }

  return (
    <div role="radiogroup" aria-label={label} className={groupClass}>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            SEGMENT,
            "has-checked:bg-background has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-not-allowed",
          )}
        >
          <input
            type="radio"
            className="sr-only"
            name={name ?? fallbackName}
            value={option.value}
            disabled={disabled}
            {...(value === undefined
              ? { defaultChecked: option.value === defaultValue }
              : { checked: option.value === value })}
            onChange={onValueChange ? () => onValueChange(option.value) : undefined}
          />
          {option.label}
        </label>
      ))}
    </div>
  )
}

export { SegmentedControl, type SegmentedOption }
