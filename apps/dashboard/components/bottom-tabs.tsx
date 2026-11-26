"use client"

import { cn } from "@ritorno/ui/lib/utils"
import { HomeIcon, InboxIcon, PlusIcon, ScanLineIcon, UsersRoundIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { activeHref } from "@/lib/nav"

// i18n-used: shell.tabs

const TABS = [
  { href: "/", label: "home", icon: HomeIcon },
  { href: "/guests", label: "guests", icon: UsersRoundIcon },
  { href: "/guests/new", label: "addGuest", icon: PlusIcon, primary: true },
  { href: "/redeem", label: "redeem", icon: ScanLineIcon },
  { href: "/inbox", label: "inbox", icon: InboxIcon },
] as const satisfies { href: Route; label: string; icon: typeof HomeIcon; primary?: boolean }[]

/** The daily front desk tasks under the thumb, with adding a guest in the middle. The rest sits in the top bar's "More". */
export function BottomTabs({ unread }: { unread: number }) {
  const pathname = usePathname()
  const t = useTranslations("nav")
  const tShell = useTranslations("shell")
  const active = activeHref(
    TABS.map((tab) => tab.href),
    pathname,
  )
  return (
    <nav
      aria-label={tShell("tabs")}
      className="fixed inset-x-0 bottom-consent z-40 flex border-border border-t bg-background pb-safe md:hidden"
    >
      {TABS.map((tab) => {
        const current = tab.href === active
        if ("primary" in tab)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={t(tab.label)}
              aria-current={current ? "page" : undefined}
              className="flex min-h-14 flex-1 items-center justify-center"
            >
              <span className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95">
                <tab.icon className="size-5" />
              </span>
            </Link>
          )
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-caption transition-colors",
              "before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-blue-500 before:opacity-0 before:transition-opacity",
              current ? "font-medium text-foreground before:opacity-100" : "text-muted-foreground",
            )}
          >
            <span className="relative">
              <tab.icon className="size-5" />
              {tab.href === "/inbox" && unread > 0 ? (
                <>
                  <span
                    aria-hidden
                    className="-end-1 -top-0.5 absolute size-2 rounded-full bg-blue-500 ring-2 ring-background"
                  />
                  <span className="sr-only">{tShell("unread", { count: unread })}</span>
                </>
              ) : null}
            </span>
            <span className="max-w-full truncate px-1">{t(tab.label)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
