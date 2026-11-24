import { cn } from "@le-hoetel/ui/lib/utils"
import { useId } from "react"

/** A quiet eight-point star lattice. Draws in `currentColor`, fades to nothing at the bottom, never carries meaning. */
export function Zellige({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg
      aria-hidden
      focusable="false"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      style={{ maskImage: "linear-gradient(to bottom, #000 30%, transparent)" }}
    >
      <defs>
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="12" y="12" width="24" height="24" />
            <rect x="12" y="12" width="24" height="24" transform="rotate(45 24 24)" />
            <path d="M0 -6L6 0L0 6L-6 0ZM48 -6L54 0L48 6L42 0ZM0 42L6 48L0 54L-6 48ZM48 42L54 48L48 54L42 48Z" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}
