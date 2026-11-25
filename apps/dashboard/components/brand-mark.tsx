import { cn } from "@le-hoetel/ui/lib/utils"

export function BrandMark({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-heading font-semibold tracking-tight", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M7.5 7.5h9v9h-9z" strokeLinejoin="round" />
          <path d="M12 3.2 20.8 12 12 20.8 3.2 12z" strokeLinejoin="round" />
        </svg>
      </span>
      {showName ? <span>le-hoetel</span> : <span className="sr-only">le-hoetel</span>}
    </span>
  )
}
