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
import { LogOutIcon, MenuIcon, MessageSquareIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { openFeedback } from "@/components/feedback-button"
import { setLocale } from "@/components/preferences-menu"
import { type Me, signOut, UserAvatar } from "@/components/user-menu"
import { activeHref, navGroups } from "@/lib/nav"

// i18n-used: shell.more
// i18n-used: shell.appearance

/** Every page on a phone, grouped like the sidebar, plus language, feedback and sign out. Opens from the inline start. */
export function MoreSheet({ me, className }: { me: Me; className?: string }) {
  const t = useTranslations("nav")
  const tShell = useTranslations("shell")
  const locale = useLocale()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const groups = navGroups(me.role)
  const active = activeHref(
    groups.flatMap((group) => group.items.map((item) => item.href)),
    pathname,
  )
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className={cn("size-11", className)} aria-label={tShell("more")} />}
      >
        <MenuIcon className="size-5" />
      </SheetTrigger>
      <SheetContent side="start" className="w-5/6 gap-0 overflow-y-auto bg-sidebar pt-safe pb-safe">
        <SheetHeader className="border-sidebar-border border-b">
          <SheetTitle className="flex items-center gap-3 pe-10">
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
        <nav className="flex flex-col gap-4 p-3" aria-label={tShell("mainNav")}>
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-0.5">
              <h2 className="px-3 pb-1 font-medium text-muted-foreground text-xs">{t(group.label)}</h2>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={item.href === active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/70 aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-foreground aria-[current=page]:shadow-xs aria-[current=page]:ring-1 aria-[current=page]:ring-sidebar-border"
                >
                  <item.icon className="size-5 text-muted-foreground" />
                  {t(item.label)}
                </Link>
              ))}
            </section>
          ))}
        </nav>
        <div className="flex flex-col gap-4 border-sidebar-border border-t p-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-muted-foreground text-xs">{tShell("language")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {LOCALES.map((value) => (
                <Button
                  key={value}
                  variant={locale === value ? "default" : "outline"}
                  aria-pressed={locale === value}
                  onClick={() => value !== locale && setLocale(value)}
                >
                  {LOCALE_NAMES[value]}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col">
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                setOpen(false)
                openFeedback()
              }}
            >
              <MessageSquareIcon data-icon="inline-start" />
              {tShell("feedback")}
            </Button>
            <Button variant="ghost" className="justify-start" onClick={signOut}>
              <LogOutIcon data-icon="inline-start" />
              {tShell("signOut")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
