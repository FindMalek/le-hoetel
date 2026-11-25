"use client"

import { GUEST_SOURCES } from "@ritorno/common/consent"
import { GUEST_CONSENT_FILTERS } from "@ritorno/common/schemas"
import { LOCALE_NAMES, LOCALES } from "@ritorno/i18n"
import { Button } from "@ritorno/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@ritorno/ui/components/dropdown-menu"
import { Input } from "@ritorno/ui/components/input"
import { cn } from "@ritorno/ui/lib/utils"
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"

export interface GuestFilterValues {
  q?: string
  consent?: string
  source?: string
  language?: string
}

type Key = keyof GuestFilterValues

const chip =
  "inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm outline-none transition-colors duration-150 coarse:h-11 focus-visible:ring-2 focus-visible:ring-ring/50"

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href as never}
      replace
      scroll={false}
      aria-pressed={active}
      className={cn(
        chip,
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  )
}

/** The url holds the filters, so a view can be shared and survives a refresh. Chips are links, search waits for a pause in typing. */
export function GuestFilters({ values }: { values: GuestFilterValues }) {
  const t = useTranslations("guests")
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState(values.q ?? "")
  const active = Boolean(values.q || values.consent || values.source || values.language)

  const href = (patch: Partial<Record<Key, string | undefined>>) => {
    const next = { ...values, ...patch }
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value)
    const text = params.toString()
    return text ? `${pathname}?${text}` : pathname
  }
  const toggle = (key: Key, value: string) => href({ [key]: values[key] === value ? undefined : value })

  useEffect(() => setQuery(values.q ?? ""), [values.q])

  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new query should restart the timer
  useEffect(() => {
    if (query.trim() === (values.q ?? "")) return
    const timer = setTimeout(
      () => startTransition(() => router.replace(href({ q: query.trim() || undefined }) as never, { scroll: false })),
      350,
    )
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault()
          startTransition(() => router.replace(href({ q: query.trim() || undefined }) as never, { scroll: false }))
        }}
      >
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
        />
        <Input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          aria-label={t("search")}
          enterKeyHint="search"
          autoComplete="off"
          className="ps-9"
        />
      </form>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {GUEST_CONSENT_FILTERS.map((value) => (
          <Chip key={value} href={toggle("consent", value)} active={values.consent === value}>
            {t(`consent.${value}`)}
          </Chip>
        ))}
        <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
        {LOCALES.map((value) => (
          <Chip key={value} href={toggle("language", value)} active={values.language === value}>
            {LOCALE_NAMES[value]}
          </Chip>
        ))}
        <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className={cn(
                  chip,
                  values.source
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                )}
              />
            }
          >
            {values.source ? t(`source.${values.source as (typeof GUEST_SOURCES)[number]}`) : t("filter.source")}
            <ChevronDownIcon className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={values.source ?? ""}
              onValueChange={(value) =>
                startTransition(() => router.replace(href({ source: value || undefined }) as never, { scroll: false }))
              }
            >
              <DropdownMenuRadioItem value="">{t("filter.any")}</DropdownMenuRadioItem>
              {GUEST_SOURCES.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {t(`source.${value}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 coarse:h-11"
            render={<Link href={pathname as never} replace />}
            nativeButton={false}
          >
            <XIcon data-icon="inline-start" />
            {t("reset")}
          </Button>
        )}
      </div>
    </div>
  )
}
