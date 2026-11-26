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
import { LanguagesIcon, LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { visibleNav } from "@/lib/nav"

const OPEN_EVENT = "open-command-palette"

export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT))

export function CommandPalette({ role }: { role: string | null }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const t = useTranslations("shell")
  const tNav = useTranslations("nav")

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      setOpen((value) => !value)
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  const run = (action: () => void | Promise<void>) => () => {
    setOpen(false)
    void action()
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("searchPlaceholder")} />
      <CommandList>
        <CommandEmpty>{t("noResults")}</CommandEmpty>
        <CommandGroup heading={t("goTo")}>
          {visibleNav(role).map((item) => (
            <CommandItem key={item.href} value={`go ${tNav(item.label)}`} onSelect={run(() => router.push(item.href))}>
              <item.icon />
              {tNav(item.label)}
            </CommandItem>
          ))}
        </CommandGroup>
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
    </CommandDialog>
  )
}
