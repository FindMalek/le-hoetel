"use client"

import { formatPhone } from "@ritorno/common/phone"
import type { Guest, GuestListItem } from "@ritorno/common/schemas"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { orpc } from "@ritorno/orpc/react"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { useInfiniteQuery } from "@tanstack/react-query"
import { ChevronRightIcon, MailIcon, MessageCircleIcon, RepeatIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { LoadError, LoadMore } from "@/components/load-more"
import { guestsList } from "@/lib/lists"

/** Two recorded visits or more: the front desk greets them as a returning guest. */
export const isReturning = (visits: number): boolean => visits >= 2

export function ConsentBadges({ consents }: { consents: Guest["consents"] }) {
  const t = useTranslations("guests.consent")
  if (!consents.email && !consents.whatsapp) return <StatusBadge tone="neutral">{t("none")}</StatusBadge>
  return (
    <span className="flex flex-wrap gap-1">
      {consents.whatsapp && (
        <StatusBadge tone="success" icon={<MessageCircleIcon />}>
          {t("whatsapp")}
        </StatusBadge>
      )}
      {consents.email && (
        <StatusBadge tone="success" icon={<MailIcon />}>
          {t("email")}
        </StatusBadge>
      )}
    </span>
  )
}

export function ReturningBadge({ visits }: { visits: number }) {
  const t = useTranslations("guests")
  if (!isReturning(visits)) return null
  return (
    <StatusBadge tone="info" icon={<RepeatIcon />}>
      {t("returning", { count: visits })}
    </StatusBadge>
  )
}

export const Phone = ({ value }: { value: string }) => (
  <bdi dir="ltr" className="tabular-nums">
    {formatPhone(value)}
  </bdi>
)

/** A plain `YYYY-MM-DD` day (birthday, stay dates) is read as UTC so it never shifts by a timezone. */
const toDate = (value: Date | string) => (typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value)

/**
 * Every date of the guest pages: "Nov 26, 2026", with `time` "Nov 26, 2026, 14:05", with `to` a range
 * "Nov 15 – 22, 2026". Viewer timezone for moments, UTC for plain days, so the server text may differ.
 */
export function GuestDate({ value, to, time = false }: { value: Date | string; to?: Date | string; time?: boolean }) {
  const locale = useLocale()
  const day = typeof value === "string" ? "UTC" : undefined
  const start = toDate(value)
  let text = formatDate(start, locale, day)
  if (to) {
    text = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
      numberingSystem: "latn",
      timeZone: day,
    }).formatRange(start, toDate(to))
  } else if (time) {
    const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", numberingSystem: "latn" })
    text = `${text}, ${clock.format(start)}`
  }
  return (
    <time dateTime={typeof value === "string" ? value : value.toISOString()} suppressHydrationWarning>
      {text}
    </time>
  )
}

type GuestListProps = {
  hotelId: string
  query: Parameters<typeof guestsList>[2]
  filtered: boolean
  filters: React.ReactNode
  empty: React.ReactNode
}

export function GuestList({ hotelId, query, filtered, filters, empty }: GuestListProps) {
  const t = useTranslations("guests")
  const list = useInfiniteQuery(guestsList(orpc, hotelId, query))
  const guests = list.data?.pages.flatMap((page) => page.items) ?? []
  const total = list.data?.pages.at(-1)?.total ?? 0

  const columns: DataColumn<GuestListItem>[] = [
    {
      id: "guest",
      header: t("columns.guest"),
      cell: (guest) => (
        <span className="flex flex-wrap items-center gap-2">
          <Link
            href={`/guests/${guest.id}`}
            className="font-medium underline-offset-4 hover:underline focus-visible:underline"
          >
            {guest.name}
          </Link>
          <ReturningBadge visits={guest.visits} />
        </span>
      ),
    },
    { id: "phone", header: t("columns.phone"), cell: (guest) => <Phone value={guest.phoneE164} /> },
    { id: "consent", header: t("columns.consent"), cell: (guest) => <ConsentBadges consents={guest.consents} /> },
    {
      id: "language",
      header: t("columns.language"),
      showFrom: "lg",
      cell: (guest) => LOCALE_NAMES[guest.language],
    },
    {
      id: "source",
      header: t("columns.source"),
      showFrom: "xl",
      cell: (guest) => <span className="text-muted-foreground">{t(`source.${guest.source}`)}</span>,
    },
    {
      id: "added",
      header: t("columns.added"),
      align: "end",
      cell: (guest) => (
        <span className="text-muted-foreground">
          <GuestDate value={guest.createdAt} />
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <DataList
        caption={t("title")}
        filters={total > 0 || filtered ? <div className="w-full">{filters}</div> : undefined}
        columns={columns}
        rows={guests}
        loading={list.isPending ? { label: t("title") } : undefined}
        getRowKey={(guest) => guest.id}
        empty={list.isError && !list.data ? <LoadError onRetry={list.refetch} /> : empty}
        linkComponent={Link}
        card={(guest) => (
          <Link href={`/guests/${guest.id}`} className="-m-4 flex min-h-11 items-center gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{guest.name}</span>
                <ReturningBadge visits={guest.visits} />
              </div>
              <span className="text-muted-foreground text-sm">
                <Phone value={guest.phoneE164} /> · {LOCALE_NAMES[guest.language]}
              </span>
              <ConsentBadges consents={guest.consents} />
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
          </Link>
        )}
      />
      <LoadMore query={list} shown={guests.length} total={total} />
    </div>
  )
}
