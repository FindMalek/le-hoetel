"use client"

import { Button } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { ArrowRightIcon, MenuIcon } from "lucide-react"
import { lazy, Suspense, useState } from "react"
import { Logo } from "./logo"

// The menu sheet (a dialog) is only needed under lg once tapped, so its code stays out of the first load.
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
  /** The app's sign-in: the arrow from sm, a link in the phone menu. */
  signIn?: PillNavLink
  navLabel: string
  menuLabel: string
  /** `div` when the page already has its own banner, like a preview inside docs. */
  as?: "header" | "div"
  className?: string
}

/** Floating white pill with the links at inline-start and the black demo pill and sign-in arrow at inline-end. Links move to a top sheet under lg. */
export function PillNav({
  homeHref,
  homeLabel,
  links,
  cta,
  signIn,
  navLabel,
  menuLabel,
  as: Root = "header",
  className,
}: PillNavProps) {
  const [open, setOpen] = useState(false)
  // Stays mounted after the first open so the sheet can animate out.
  const [loaded, setLoaded] = useState(false)
  return (
    <Root
      data-slot="pill-nav"
      className={cn(
        "pointer-events-none fixed inset-x-3 top-3 z-40 flex items-center justify-between gap-2 md:inset-x-4 md:top-4",
        className,
      )}
    >
      <div className="pointer-events-auto flex h-12 min-w-0 items-center gap-1 rounded-full bg-background ps-2 pe-1 shadow-md">
        <a href={homeHref} className="flex h-11 min-w-0 items-center rounded-full ps-1 pe-2 lg:pe-4">
          <Logo size={32} label={homeLabel} />
        </a>
        <nav aria-label={navLabel} className="hidden items-center lg:flex">
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
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setLoaded(true)
            setOpen(true)
          }}
        >
          <MenuIcon />
          <span className="sr-only">{menuLabel}</span>
        </Button>
        {loaded ? (
          <Suspense fallback={null}>
            <PillNavSheet
              open={open}
              onOpenChange={setOpen}
              links={signIn ? [...links, signIn] : links}
              navLabel={navLabel}
              menuLabel={menuLabel}
            />
          </Suspense>
        ) : null}
      </div>
      <div className="pointer-events-auto flex shrink-0 items-center gap-1">
        <a
          href={cta.href}
          className="flex h-12 items-center rounded-full bg-foreground px-5 text-small font-medium text-background shadow-md outline-none transition-colors duration-200 hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {cta.label}
        </a>
        {signIn ? (
          <a
            href={signIn.href}
            aria-label={signIn.label}
            title={signIn.label}
            className="hidden size-11 place-items-center rounded-full bg-foreground text-background shadow-md outline-none transition-transform duration-200 ease-out hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:grid rtl:hover:-translate-x-0.5"
          >
            <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
          </a>
        ) : null}
      </div>
    </Root>
  )
}
