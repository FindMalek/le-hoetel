import { cn } from "@ritorno/ui/lib/utils"
import { ArrowUpRightIcon } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

const SPANS = {
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
} as const

/** Six column bento on a surface panel; tiles stack under md. */
export function BentoGrid({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="bento-grid"
      className={cn("grid gap-2 rounded-panel bg-surface p-2 md:grid-cols-6 md:gap-3 md:p-3", className)}
      {...props}
    />
  )
}

export interface BentoTileProps extends Omit<ComponentProps<"article">, "title"> {
  title: ReactNode
  description?: ReactNode
  chips?: ReactNode
  media?: ReactNode
  span?: keyof typeof SPANS
  /** Makes the whole tile a link (through the title) and shows the corner arrow. */
  href?: string
}

export function BentoTile({ title, description, chips, media, span = 2, href, className, ...props }: BentoTileProps) {
  return (
    <article
      data-slot="bento-tile"
      className={cn(
        "group/tile relative flex flex-col overflow-hidden rounded-card border bg-card p-5 transition-shadow duration-200 ease-out has-[a:hover]:shadow-md md:p-6",
        SPANS[span],
        className,
      )}
      {...props}
    >
      {chips ? <div className={cn("mb-4 flex flex-wrap gap-1.5", href && "pe-12")}>{chips}</div> : null}
      <h3 className={cn("text-h3 text-foreground", href && "pe-12")}>
        {href ? (
          <a
            href={href}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </h3>
      {description ? <p className="mt-1.5 text-small text-muted-foreground">{description}</p> : null}
      {media ? <div className="-mx-5 -mb-5 mt-6 flex flex-1 items-end md:-mx-6 md:-mb-6">{media}</div> : null}
      {href ? (
        <span
          aria-hidden
          className="absolute end-4 top-4 grid size-11 place-items-center rounded-full bg-foreground text-background transition-transform duration-200 ease-out group-has-[a:hover]/tile:-translate-y-0.5 md:end-5 md:top-5"
        >
          <ArrowUpRightIcon className="size-4 rtl:-scale-x-100" />
        </span>
      ) : null}
    </article>
  )
}
