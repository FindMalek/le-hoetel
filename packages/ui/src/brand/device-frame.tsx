import { cn } from "@ritorno/ui/lib/utils"
import type { ReactNode } from "react"

interface FrameProps {
  /** Translated description of what the shot shows; the mockup inside is inert. */
  label: string
  children: ReactNode
  className?: string
}

export function BrowserFrame({ label, url, children, className }: FrameProps & { url?: string }) {
  return (
    <figure
      role="img"
      aria-label={label}
      data-slot="browser-frame"
      className={cn(
        "m-0 overflow-hidden rounded-browser bg-background shadow-device ring-1 ring-foreground/8",
        className,
      )}
    >
      <div className="grid h-9 grid-cols-[1fr_auto_1fr] items-center border-b bg-surface px-3.5">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-foreground/12" />
          <span className="size-2.5 rounded-full bg-foreground/12" />
          <span className="size-2.5 rounded-full bg-foreground/12" />
        </div>
        {url ? (
          <span
            dir="ltr"
            className="h-6 min-w-0 truncate rounded-full bg-background px-3 text-caption leading-6 text-muted-foreground ring-1 ring-foreground/6 sm:min-w-56 sm:text-center"
          >
            {url}
          </span>
        ) : null}
      </div>
      <div inert className="select-none">
        {children}
      </div>
    </figure>
  )
}

export function PhoneFrame({ label, children, className }: FrameProps) {
  return (
    <figure
      role="img"
      aria-label={label}
      data-slot="phone-frame"
      className={cn("m-0 aspect-[9/19.5] w-full max-w-72 rounded-phone bg-ink-900 p-1.5 shadow-device", className)}
    >
      <div className="relative size-full overflow-hidden rounded-[34px] bg-background ring-1 ring-foreground/10">
        <span aria-hidden className="absolute inset-x-0 top-2 z-10 mx-auto h-5 w-20 rounded-full bg-ink-900" />
        <div inert className="size-full select-none overflow-hidden">
          {children}
        </div>
      </div>
    </figure>
  )
}
