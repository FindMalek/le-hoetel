"use client"

import { Button } from "@le-hoetel/ui/components/button"
import { Kbd } from "@le-hoetel/ui/components/kbd"
import { SidebarTrigger } from "@le-hoetel/ui/components/sidebar"
import { SearchIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { openCommandPalette } from "@/components/command-palette"
import { navFor } from "@/lib/nav"

const ACTION_SLOT = "topbar-action"

/** The one primary action of a page, in the top bar: icon and label on desktop, icon only on a phone. */
export function TopBarAction({ href, label, icon }: { href: Route; label: string; icon: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById(ACTION_SLOT)), [])
  if (!slot) return null
  return createPortal(
    <>
      <Button className="max-md:hidden" render={<Link href={href} />} nativeButton={false}>
        {icon}
        {label}
      </Button>
      <Button size="icon" className="md:hidden" aria-label={label} render={<Link href={href} />} nativeButton={false}>
        {icon}
      </Button>
    </>,
    slot,
  )
}

export function TopBar({ bell }: { bell: React.ReactNode }) {
  const t = useTranslations("nav")
  const tShell = useTranslations("shell")
  const item = navFor(usePathname())
  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 pt-safe backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-6">
      <SidebarTrigger className="max-md:hidden" />
      <p className="min-w-0 flex-1 truncate font-medium text-sm">{item ? t(item.label) : null}</p>
      <div id={ACTION_SLOT} className="flex items-center gap-2" />
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={tShell("search")}
        onClick={openCommandPalette}
      >
        <SearchIcon />
      </Button>
      <Button variant="outline" className="text-muted-foreground max-md:hidden" onClick={openCommandPalette}>
        <SearchIcon data-icon="inline-start" />
        {tShell("search")}
        <Kbd dir="ltr">⌘K</Kbd>
      </Button>
      {bell}
    </div>
  )
}
