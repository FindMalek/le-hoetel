"use client"

import { Sheet, SheetContent, SheetTitle } from "@ritorno/ui/components/sheet"
import type { PillNavLink } from "./pill-nav"

export interface PillNavSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: PillNavLink[]
  navLabel: string
  menuLabel: string
}

/** The phone menu of `PillNav`, loaded on first tap. */
export default function PillNavSheet({ open, onOpenChange, links, navLabel, menuLabel }: PillNavSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="rounded-b-card px-4 pt-safe pb-4">
        <SheetTitle className="sr-only">{menuLabel}</SheetTitle>
        <nav aria-label={navLabel} className="mt-14 flex flex-col">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => onOpenChange(false)}
              className="flex min-h-touch items-center border-b text-lead text-foreground last:border-b-0"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
