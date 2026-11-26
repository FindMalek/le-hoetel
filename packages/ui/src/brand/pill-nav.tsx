"use client"

import { Button } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { ArrowRightIcon, MenuIcon } from "lucide-react"
import { lazy, type ReactNode, Suspense, useState } from "react"
import { Logo } from "./logo"

// The menu sheet (a dialog) is only needed under md once tapped, so its code stays out of the first load.
const PillNavSheet = lazy(() => import("./pill-nav-sheet"))

export interface PillNavLink {
  href: string
  label: string
}

export interface PillNavProps {
  homeHref: string
  /** Accessible name of the home link, the product name by default. */
  homeLabel?: string
  links: PillNavLink[]
  cta: PillNavLink
  /** Ghost language pill (a select or links), shown in the bar from md and in the sheet below. */
  language?: ReactNode
  navLabel: string
  menuLabel: string
  /** `div` when the page already has its own banner, like a preview inside docs. */
  as?: "header" | "div"
  className?: string
}

/** Floating white pill with the links at inline-start and the black demo pill plus arrow at inline-end. Links move to a top sheet under md. */
export function PillNav({
  homeHref,
  homeLabel,
  links,
  cta,
  language,
  navLabel,
  menuLabel,
  as: Root = "header",
  className,
}: PillNavProps) {
  const [open, setOpen] = useState(false)
  return (
    <Root
      data-slot="pill-nav"
      className={cn(
        "pointer-events-none fixed inset-x-3 top-3 z-40 flex items-center justify-between gap-2 md:inset-x-4 md:top-4",
        className,
      )}
    >
      <div className="pointer-events-auto flex h-12 min-w-0 items-center gap-1 rounded-full bg-background ps-2 pe-1 shadow-md">
        <a href={homeHref} className="flex h-11 min-w-0 items-center rounded-full ps-1 pe-2 md:pe-4">
          <Logo size={32} label={homeLabel} />
        </a>
        <nav aria-label={navLabel} className="hidden items-center md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex h-11 items-center rounded-full px-3 text-small text-muted-foreground transition-colors duration-200 hover:bg-surface hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        {language ? <div className="hidden md:block">{language}</div> : null}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <MenuIcon />
          <span className="sr-only">{menuLabel}</span>
        </Button>
        {open ? (
          <Suspense fallback={null}>
            <PillNavSheet
              open={open}
              onOpenChange={setOpen}
              links={links}
              language={language}
              navLabel={navLabel}
              menuLabel={menuLabel}
            />
          </Suspense>
        ) : null}
      </div>
      <a
        href={cta.href}
        className="group/cta pointer-events-auto flex shrink-0 items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex h-12 items-center rounded-full bg-foreground px-5 text-small font-medium text-background shadow-md transition-colors duration-200 group-hover/cta:bg-foreground/85">
          {cta.label}
        </span>
        <span
          aria-hidden
          className="hidden size-11 place-items-center rounded-full bg-foreground text-background shadow-md transition-transform duration-200 ease-out group-hover/cta:translate-x-0.5 sm:grid rtl:group-hover/cta:-translate-x-0.5"
        >
          <ArrowRightIcon className="size-4 rtl:rotate-180" />
        </span>
      </a>
    </Root>
  )
}
