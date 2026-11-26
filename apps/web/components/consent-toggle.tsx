import { cn } from "@ritorno/ui/lib/utils"
import type { ComponentProps } from "react"

export function ConsentToggle({
  title,
  wording,
  className,
  ...input
}: { title: string; wording: string } & ComponentProps<"input">) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors duration-150 has-checked:border-primary/60 has-checked:bg-primary/5",
        className,
      )}
    >
      <input type="checkbox" className="peer sr-only" {...input} />
      <span className="order-1 grid flex-1 gap-1">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-xs leading-relaxed rtl:text-[0.8125rem]">{wording}</span>
      </span>
      <span
        aria-hidden
        className="relative order-2 mt-0.5 h-6 w-11 shrink-0 rounded-full bg-input transition-colors duration-150 after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform after:duration-150 peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface rtl:peer-checked:after:-translate-x-5"
      />
    </label>
  )
}
