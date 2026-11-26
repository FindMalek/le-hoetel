"use client"

import { authClient } from "@ritorno/auth/client"
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES } from "@ritorno/i18n"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ritorno/ui/components/command"
import { Kbd, KbdGroup } from "@ritorno/ui/components/kbd"
import { LanguagesIcon, LogOutIcon, MessageSquareIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { openFeedback } from "@/components/feedback-button"
import { navGroups, visibleNav } from "@/lib/nav"

const OPEN_EVENT = "open-command-palette"
const SEQUENCE_MS = 1000

export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT))

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

export function CommandPalette({ role }: { role: string | null }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useTranslations("shell")
  const tNav = useTranslations("nav")

  useEffect(() => {
    let pendingG = 0
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      if (pendingG && Date.now() - pendingG < SEQUENCE_MS) {
        pendingG = 0
        const item = visibleNav(role).find((entry) => entry.shortcut === key)
        if (item) router.push(item.href)
        return
      }
      if (key === "g") pendingG = Date.now()
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [role, router])

  const run = (action: () => void | Promise<void>) => () => {
    setOpen(false)
    void action()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t("search")} description={t("searchPlaceholder")}>
      <CommandInput placeholder={t("searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("noResults")}</CommandEmpty>
        {navGroups(role).map((group) => (
          <CommandGroup key={group.key} heading={tNav(group.label)}>
            {group.items.map((item) => (
              <CommandItem
                key={item.href}
                value={`${t("goTo")} ${tNav(item.label)} ${item.href}`}
                onSelect={run(() => router.push(item.href))}
              >
                <item.icon />
                {tNav(item.label)}
                {item.shortcut ? (
                  <KbdGroup aria-hidden className="ms-auto">
                    <Kbd>G</Kbd>
                    <Kbd>{item.shortcut.toUpperCase()}</Kbd>
                  </KbdGroup>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading={t("language")}>
          {LOCALES.map((locale) => (
            <CommandItem
              key={locale}
              value={`language ${LOCALE_NAMES[locale]}`}
              onSelect={run(() => {
                // biome-ignore lint/suspicious/noDocumentCookie: cookieStore is missing in some browsers
                document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
                window.location.reload()
              })}
            >
              <LanguagesIcon />
              {LOCALE_NAMES[locale]}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading={t("account")}>
          <CommandItem value={`feedback ${t("feedback")}`} onSelect={run(openFeedback)}>
            <MessageSquareIcon />
            {t("feedback")}
          </CommandItem>
          <CommandItem
            value={`account ${t("signOut")}`}
            onSelect={run(async () => {
              await authClient.signOut()
              window.location.assign("/sign-in")
            })}
          >
            <LogOutIcon />
            {t("signOut")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <p className="border-t px-3 py-2 text-caption text-muted-foreground coarse:hidden">{t("shortcuts")}</p>
    </CommandDialog>
  )
}
