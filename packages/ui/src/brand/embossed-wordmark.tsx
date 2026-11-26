import { cn } from "@ritorno/ui/lib/utils"
import { Logo } from "./logo"

/** Giant inset wordmark for the footer. It must sit on the canvas color so the fill disappears and only the emboss reads. */
export function EmbossedWordmark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-slot="embossed-wordmark"
      className={cn(
        "flex select-none justify-center text-canvas [&_svg]:h-auto [&_svg]:w-[72vw] [&_svg]:[filter:drop-shadow(0_-1px_0_var(--background))_drop-shadow(0_1px_0_color-mix(in_oklch,var(--ink-900)_12%,transparent))_drop-shadow(0_3px_3px_color-mix(in_oklch,var(--ink-900)_8%,transparent))_drop-shadow(0_12px_24px_color-mix(in_oklch,var(--ink-900)_6%,transparent))]",
        className,
      )}
    >
      <Logo variant="wordmark" size={200} />
    </div>
  )
}
