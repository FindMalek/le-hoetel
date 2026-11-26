"use client"

import { formatPhone } from "@ritorno/common/phone"
import type { Guest, GuestListItem } from "@ritorno/common/schemas"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { pageWindow } from "@ritorno/ui/lib/pagination"
import { ChevronRightIcon, MailIcon, MessageCircleIcon, RepeatIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

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
  guests: GuestListItem[]
  total: number
  page: number
  pageSize: number
  previousHref?: string
  nextHref?: string
  filters: React.ReactNode
  empty: React.ReactNode
}

export function GuestList({ guests, total, page, pageSize, previousHref, nextHref, filters, empty }: GuestListProps) {
  const t = useTranslations("guests")
  const locale = useLocale()
  const pages = pageWindow({ page, pageSize, total })

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
    <DataList
      caption={t("title")}
      filters={filters ? <div className="w-full">{filters}</div> : undefined}
      columns={columns}
      rows={guests}
      getRowKey={(guest) => guest.id}
      empty={empty}
      linkComponent={Link}
      pagination={{
        previousLabel: t("previous"),
        nextLabel: t("next"),
        previous: previousHref ? { href: previousHref } : undefined,
        next: nextHref ? { href: nextHref } : undefined,
        range: {
          ...pages,
          total,
          locale,
          label: (numbers) =>
            t.rich("range", { from: () => numbers.from, to: () => numbers.to, total: () => numbers.total }),
        },
      }}
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
  )
}
