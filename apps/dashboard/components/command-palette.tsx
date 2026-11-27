"use client"

import { authClient } from "@ritorno/auth/client"
import { LOCALE_COOKIE, LOCALE_NAMES, LOCALES } from "@ritorno/i18n"
import { orpc } from "@ritorno/orpc/react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  SERVER_MATCH,
} from "@ritorno/ui/components/command"
import { Kbd, KbdGroup } from "@ritorno/ui/components/kbd"
import { useQuery } from "@tanstack/react-query"
import { LanguagesIcon, LogOutIcon, MessageSquareIcon, UserRoundIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { openFeedback } from "@/components/feedback-button"
import { navGroups, quickActions, visibleNav } from "@/lib/nav"
import { useDebounced } from "@/lib/use-debounced"
import { allows, type Viewer } from "@/lib/viewer"

const OPEN_EVENT = "open-command-palette"
const SEQUENCE_MS = 1000

export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_EVENT))

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

export function CommandPalette({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
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
        const item = visibleNav(viewer).find((entry) => entry.shortcut === key)
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
  }, [viewer, router])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  // `guests.find` takes 2 to 80 characters.
  const term = search.trim().slice(0, 80)
  const q = useDebounced(term)
  const searching = allows(viewer.role, { guest: ["read"] }) && term.length >= 2
  const found = useQuery({
    ...orpc.guests.find.queryOptions({ input: { q } }),
    enabled: searching && q.length >= 2,
    placeholderData: (data) => data,
  })
  const guests = searching ? (found.data ?? []) : []
  const pending = searching && (q !== term || found.isFetching)
  const failed = searching && !pending && found.isError
  const actions = quickActions(viewer)

  const run = (action: () => void | Promise<void>) => () => {
    setOpen(false)
    void action()
  }

  const placeholder = allows(viewer.role, { guest: ["read"] }) ? t("searchGuestsPlaceholder") : t("searchPlaceholder")

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t("search")} description={placeholder}>
      <CommandInput value={search} onValueChange={setSearch} placeholder={placeholder} />
      <CommandList>
        {failed ? (
          <p role="alert" className="px-3 py-2 text-destructive text-sm">
            {t("searchError")}
          </p>
        ) : guests.length ? null : (
          <CommandEmpty>{pending ? t("searching") : t("noResults")}</CommandEmpty>
        )}
        {guests.length ? (
          <CommandGroup heading={tNav("guests")}>
            {guests.map((guest) => (
              <CommandItem
                key={guest.id}
                value={`${SERVER_MATCH}${guest.id}`}
                onSelect={run(() => router.push(`/guests/${guest.id}`))}
              >
                <UserRoundIcon />
                <span dir="auto" className="min-w-0 flex-1 truncate">
                  {guest.name}
                </span>
                <bdi dir="ltr" className="shrink-0 text-muted-foreground tabular-nums">
                  {guest.phoneE164}
                </bdi>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {actions.length ? (
          <CommandGroup heading={t("quickActions")}>
            {actions.map((action) => (
              <CommandItem
                key={action.label}
                value={`action ${t(`actions.${action.label}`)}`}
                onSelect={run(() => router.push(action.href))}
              >
                <action.icon />
                {t(`actions.${action.label}`)}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {navGroups(viewer).map((group) => (
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
