"use client"

import type { MessageChannel } from "@ritorno/common/consent"
import { HOTEL_EMAIL_KEYS, type MessageStatus } from "@ritorno/common/message"
import { orpc } from "@ritorno/orpc/react"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { useInfiniteQuery } from "@tanstack/react-query"
import { MailIcon, MessageCircleIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { LoadError, LoadMore } from "@/components/load-more"
import { MessagePreview } from "@/components/message-preview"
import { messagesList } from "@/lib/lists"

const STATUS_TONE: Record<MessageStatus, StatusTone> = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  failed: "danger",
  skipped_no_consent: "neutral",
  skipped_no_balance: "warning",
}

const ChannelIcon = ({ channel }: { channel: MessageChannel }) =>
  channel === "email" ? (
    <MailIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
  ) : (
    <MessageCircleIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
  )

type MessagesListProps = {
  hotelId: string
  query: Parameters<typeof messagesList>[2]
  timeZone?: string
  filtered: boolean
  filters: React.ReactNode
  empty: React.ReactNode
}

export function MessagesList({ hotelId, query, timeZone, filtered, filters, empty }: MessagesListProps) {
  const t = useTranslations("messages")
  const locale = useLocale()
  const list = useInfiniteQuery(messagesList(orpc, hotelId, query))
  const rows = list.data?.pages.flatMap((page) => page.items) ?? []
  const total = list.data?.pages.at(-1)?.total ?? 0
  type Row = (typeof rows)[number]
  const oneOf = (value: string) => HOTEL_EMAIL_KEYS.find((option) => option === value)
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
    timeZone,
  })
  const when = (row: Row) => (
    <time dateTime={row.createdAt.toISOString()} className="tabular-nums" suppressHydrationWarning>
      {formatDate(row.createdAt, locale, timeZone)} · <bdi dir="ltr">{time.format(row.createdAt)}</bdi>
    </time>
  )
  const template = (key: string) => {
    const known = oneOf(key)
    return known ? t(`templates.${known}`) : key
  }
  const status = (row: Row) => (
    <span className="flex flex-col items-start gap-1">
      {row.notSent ? (
        <StatusBadge tone="warning">{t("preview.tag")}</StatusBadge>
      ) : (
        <StatusBadge tone={STATUS_TONE[row.status]}>{t(`statuses.${row.status}`)}</StatusBadge>
      )}
      {row.status === "failed" && row.errorCode ? (
        <bdi dir="ltr" className="font-mono text-muted-foreground text-xs">
          {row.errorCode}
        </bdi>
      ) : null}
    </span>
  )
  const preview = (row: Row) =>
    row.notSent ? <MessagePreview id={row.id} language={row.language} guestName={row.guestName} /> : null
  const guest = (row: Row) => (
    <Link
      href={`/guests/${row.guestId}`}
      className="font-medium underline-offset-4 hover:underline focus-visible:underline"
    >
      {row.guestName}
    </Link>
  )

  const columns: DataColumn<Row>[] = [
    { id: "date", header: t("date"), cell: (row) => <span className="text-muted-foreground">{when(row)}</span> },
    { id: "guest", header: t("guest"), cell: guest },
    {
      id: "channel",
      header: t("channel"),
      cell: (row) => (
        <span className="flex items-center gap-2">
          <ChannelIcon channel={row.channel} />
          {t(`channels.${row.channel}`)}
        </span>
      ),
    },
    { id: "template", header: t("template"), cell: (row) => template(row.templateKey) },
    {
      id: "language",
      header: t("language"),
      showFrom: "lg",
      cell: (row) => <span className="text-muted-foreground uppercase">{row.language}</span>,
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-2 py-2">
          {status(row)}
          {preview(row)}
        </div>
      ),
    },
  ]

  const card = (row: Row) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate">{guest(row)}</span>
        {row.notSent ? null : status(row)}
      </div>
      <span className="flex items-center gap-2 text-sm">
        <ChannelIcon channel={row.channel} />
        {template(row.templateKey)}
        <span className="text-muted-foreground">· {t(`channels.${row.channel}`)}</span>
      </span>
      <span className="text-muted-foreground text-xs">{when(row)}</span>
      {row.notSent ? (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {status(row)}
          {preview(row)}
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <DataList<Row>
        caption={t("caption")}
        filters={total > 0 || filtered ? filters : undefined}
        loading={list.isPending ? { label: t("caption") } : undefined}
        rows={rows}
        columns={columns}
        card={card}
        getRowKey={(row) => row.id}
        empty={list.isError && !list.data ? <LoadError onRetry={list.refetch} /> : empty}
        linkComponent={Link}
      />
      <LoadMore query={list} shown={rows.length} total={total} />
    </div>
  )
}
