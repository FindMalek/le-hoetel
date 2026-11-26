import { cn } from "@ritorno/ui/lib/utils"
import { ArrowRightIcon } from "lucide-react"
import type { ReactNode } from "react"

export const CONTAINER = "mx-auto w-full max-w-6xl px-4 md:px-6"
export const SECTION_Y = "py-20 md:py-28 lg:py-32"

/** Big Geist heading at inline-start, an optional lead under it and a text link at inline-end. */
export function SectionHeading({
  id,
  title,
  lead,
  link,
  className,
}: {
  id?: string
  title: ReactNode
  lead?: ReactNode
  link?: { href: string; label: string }
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10", className)}>
      <div className="grid max-w-2xl gap-3">
        <h2 id={id} className="text-balance font-medium text-h1">
          {title}
        </h2>
        {lead ? <p className="max-w-xl text-pretty text-muted-foreground">{lead}</p> : null}
      </div>
      {link ? (
        <a
          href={link.href}
          className="group/link inline-flex min-h-11 w-fit shrink-0 items-center gap-1.5 font-medium text-foreground text-small"
        >
          {link.label}
          <ArrowRightIcon
            aria-hidden
            className="size-4 transition-transform duration-200 ease-out group-hover/link:translate-x-0.5 rtl:rotate-180 rtl:group-hover/link:-translate-x-0.5"
          />
        </a>
      ) : null}
    </div>
  )
}
