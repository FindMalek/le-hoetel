import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@ritorno/ui/lib/utils"
import type { ComponentProps } from "react"

const chipVariants = cva(
  "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-medium whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-surface text-foreground [&_svg]:text-ink-400",
        info: "bg-info-soft text-info",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
)

/** Rounded label: surface fill, or a semantic soft fill. Pair a tone with an icon so meaning never rests on color alone. */
function Chip({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span data-slot="chip" className={cn(chipVariants({ tone }), className)} {...props} />
}

export { Chip, chipVariants }
