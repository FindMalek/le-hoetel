"use client"

import { LOCALE_NAMES, LOCALES } from "@ritorno/i18n"
import { Button } from "@ritorno/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@ritorno/ui/components/sheet"
import { cn } from "@ritorno/ui/lib/utils"
import { LogOutIcon, MenuIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useTheme } from "next-themes"
import { useState } from "react"
import { setLocale } from "@/components/preferences-menu"
import { type Me, signOut, UserAvatar } from "@/components/user-menu"
import { isActive, type NavItem, visibleNav } from "@/lib/nav"

// i18n-used: shell.more
// i18n-used: shell.tabs
// i18n-used: shell.appearance

const tabClass = (active: boolean) =>
  cn(
    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors",
    "before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity",
    active ? "font-medium text-foreground before:opacity-100" : "text-muted-foreground hover:text-foreground",
  )

function MoreSheet({ me, items, active }: { me: Me; items: NavItem[]; active: boolean }) {
  const t = useTranslations("nav")
  const tShell = useTranslations("shell")
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<button type="button" className={tabClass(active)} />}>
        <MenuIcon className="size-5" />
        <span>{tShell("more")}</span>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto pb-safe">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <UserAvatar me={me} className="size-10" />
            <span className="grid min-w-0 text-start leading-tight">
              <span className="truncate">{me.name}</span>
              <span className="truncate font-normal text-muted-foreground text-sm" dir="ltr">
                {me.email}
              </span>
            </span>
          </SheetTitle>
          <SheetDescription className="sr-only">{tShell("appearance")}</SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col px-4" aria-label={tShell("mainNav")}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-base hover:bg-muted"
            >
              <item.icon className="size-5 text-muted-foreground" />
              {t(item.label)}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-4 border-t p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-muted-foreground text-sm">{tShell("theme")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as const).map((value) => (
                <Button
                  key={value}
                  variant={(theme ?? "system") === value ? "secondary" : "outline"}
                  aria-pressed={(theme ?? "system") === value}
                  onClick={() => setTheme(value)}
                >
                  {tShell(value)}
                </Button>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-muted-foreground text-sm">{tShell("language")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {LOCALES.map((value) => (
                <Button
                  key={value}
                  variant={locale === value ? "secondary" : "outline"}
                  aria-pressed={locale === value}
                  onClick={() => value !== locale && setLocale(value)}
                >
                  {LOCALE_NAMES[value]}
                </Button>
              ))}
            </div>
          </fieldset>
          <Button variant="ghost" className="justify-start" onClick={signOut}>
            <LogOutIcon data-icon="inline-start" />
            {tShell("signOut")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** The four daily tasks under the thumb on a phone: the tabbed pages, then "More" for the rest. */
export function BottomTabs({ me }: { me: Me }) {
  const pathname = usePathname()
  const t = useTranslations("nav")
  const tShell = useTranslations("shell")
  const items = visibleNav(me.role)
  const tabs = items.filter((item) => item.tab)
  const rest = items.filter((item) => !item.tab)
  return (
    <nav
      aria-label={tShell("tabs")}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      {tabs.map((item) => {
        const active = isActive(item.href, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={tabClass(active)}
          >
            <item.icon className="size-5" />
            <span>{t(item.label)}</span>
          </Link>
        )
      })}
      <MoreSheet me={me} items={rest} active={rest.some((item) => isActive(item.href, pathname))} />
    </nav>
  )
}
