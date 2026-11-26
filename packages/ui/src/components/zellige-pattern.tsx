import { useId } from "react"
import { cn } from "@ritorno/ui/lib/utils"

type ZelligePatternProps = { className?: string }

/** A quiet khatim tile (two overlapping squares) in the current text color. Use sparingly, at low opacity. */
function ZelligePattern({ className }: ZelligePatternProps) {
  const id = useId()
  return (
    <svg aria-hidden="true" focusable="false" className={cn("pointer-events-none size-full text-foreground opacity-[0.07]", className)}>
      <defs>
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
            <path d="M14 14h20v20H14z" />
            <path d="M24 5.7 42.3 24 24 42.3 5.7 24z" />
            <circle cx="24" cy="24" r="3" />
            <path d="M0 0l5.7 5.7M48 0l-5.7 5.7M0 48l5.7-5.7M48 48l-5.7-5.7" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

export { ZelligePattern }
