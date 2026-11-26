"use client"

import type { AppRouterClient } from "@ritorno/orpc/client"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { PageState } from "@ritorno/ui/components/page-state"
import { useInfiniteQuery } from "@tanstack/react-query"
import { HistoryIcon, SearchXIcon } from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { LoadError, LoadMore } from "@/components/load-more"
import { LocalDate } from "@/components/local-date"
import {
  type AdminAuditFilter,
  actionLabel,
  adminAuditPages,
  type HotelAuditFilter,
  hotelAuditPages,
} from "@/lib/audit"

type AdminEntry = Awaited<ReturnType<AppRouterClient["admin"]["audit"]["list"]>>["entries"][number]
type HotelEntry = Awaited<ReturnType<AppRouterClient["audit"]["list"]>>["entries"][number]

interface FeedState<T> {
  data?: { pages: { entries: T[] }[] }
  isPending: boolean
  isError: boolean
  isFetching: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  hasNextPage: boolean
  fetchNextPage: () => unknown
  refetch: () => unknown
}

interface ListProps {
  filters: ReactNode
  filtered: boolean
  resetHref: Route
}

type FeedProps<T> = ListProps & {
  caption: string
  query: FeedState<T>
  columns: DataColumn<T>[]
  card: (entry: T) => ReactNode
}

function Feed<T extends { id: string }>({ caption, query, columns, card, filters, filtered, resetHref }: FeedProps<T>) {
  const t = useTranslations("adminAudit")
  const rows = query.data?.pages.flatMap((page) => page.entries) ?? []
  const empty = filtered ? (
    <PageState
      kind="empty"
      icon={<SearchXIcon />}
      title={t("noMatch.title")}
      description={t("noMatch.description")}
      action={
        <Button variant="outline" render={<Link href={resetHref} />} nativeButton={false}>
          {t("filters.reset")}
        </Button>
      }
    />
  ) : (
    <PageState kind="empty" icon={<HistoryIcon />} title={t("empty.title")} description={t("empty.description")} />
  )

  if (query.isError && !query.data) {
    return (
      <div className="flex flex-col gap-4">
        {filters}
        <LoadError onRetry={query.refetch} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DataList
        caption={caption}
        rows={rows}
        columns={columns}
        getRowKey={(entry) => entry.id}
        filters={filters}
        loading={query.isPending ? { label: t("loading") } : undefined}
        empty={empty}
        card={card}
      />
      <LoadMore query={query} shown={rows.length} />
    </div>
  )
}

const Muted = () => <span className="text-muted-foreground">–</span>

/** Hotel targets show as the hotel. Other targets (a guest, an offer, a user) only by a short id: the log stores no names. */
function Target({ entry }: { entry: AdminEntry }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2">
      {entry.hotelName && entry.hotelId ? (
        <Link href={`/admin/hotels/${entry.hotelId}`} className="underline-offset-4 hover:underline">
          {entry.hotelName}
        </Link>
      ) : entry.targetId ? null : (
        <Muted />
      )}
      {entry.targetId && entry.targetId !== entry.hotelId ? (
        <code className="text-caption text-muted-foreground" dir="ltr" title={entry.targetId}>
          #{entry.targetId.slice(0, 8)}
        </code>
      ) : null}
    </span>
  )
}

export function AdminAuditFeed({ filter, ...list }: ListProps & { filter: AdminAuditFilter }) {
  const t = useTranslations("adminAudit")
  const query = useInfiniteQuery(adminAuditPages(orpc, filter))
  const who = (entry: AdminEntry) => entry.actorEmail ?? t("system")
  const columns: DataColumn<AdminEntry>[] = [
    {
      id: "action",
      header: t("columns.action"),
      cell: (entry) => <span className="font-medium">{actionLabel(t, entry.action)}</span>,
    },
    { id: "who", header: t("columns.who"), cell: (entry) => <span dir="ltr">{who(entry)}</span> },
    { id: "target", header: t("columns.target"), cell: (entry) => <Target entry={entry} />, showFrom: "lg" },
    {
      id: "ip",
      header: t("columns.ip"),
      cell: (entry) => (
        <span className="text-muted-foreground" dir="ltr">
          {entry.ip ?? "–"}
        </span>
      ),
      showFrom: "xl",
    },
    {
      id: "when",
      header: t("columns.when"),
      cell: (entry) => <LocalDate value={entry.createdAt} time />,
      align: "end",
    },
  ]

  return (
    <Feed
      {...list}
      caption={t("title")}
      query={query}
      columns={columns}
      card={(entry) => (
        <div className="flex flex-col gap-1.5">
          <p className="font-medium">{actionLabel(t, entry.action)}</p>
          <p className="truncate text-muted-foreground text-small" dir="ltr">
            {who(entry)}
          </p>
          <div className="flex items-center justify-between gap-3 text-small">
            <Target entry={entry} />
            <span className="shrink-0 text-caption text-muted-foreground">
              <LocalDate value={entry.createdAt} time />
            </span>
          </div>
        </div>
      )}
    />
  )
}

/** Times are the hotel's clock, the same one the date filters use. */
export function HotelAuditFeed({
  filter,
  timeZone,
  ...list
}: ListProps & { filter: HotelAuditFilter; timeZone: string }) {
  const t = useTranslations("adminAudit")
  const locale = useLocale()
  const query = useInfiniteQuery(hotelAuditPages(orpc, filter))
  const format = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
    timeZone,
  })
  const when = (entry: HotelEntry) => (
    <time dateTime={entry.createdAt.toISOString()}>{format.format(entry.createdAt)}</time>
  )
  const who = (entry: HotelEntry) =>
    entry.actorEmail ? <bdi dir="ltr">{entry.actorEmail}</bdi> : entry.platform ? t("hotel.platform") : t("system")
  const columns: DataColumn<HotelEntry>[] = [
    {
      id: "action",
      header: t("columns.action"),
      cell: (entry) => <span className="font-medium">{actionLabel(t, entry.action)}</span>,
    },
    { id: "who", header: t("columns.who"), cell: who },
    { id: "when", header: t("columns.when"), cell: when, align: "end" },
  ]

  return (
    <Feed
      {...list}
      caption={t("hotel.title")}
      query={query}
      columns={columns}
      card={(entry) => (
        <div className="flex flex-col gap-1.5">
          <p className="font-medium">{actionLabel(t, entry.action)}</p>
          <p className="truncate text-muted-foreground text-small">{who(entry)}</p>
          <p className="text-caption text-muted-foreground">{when(entry)}</p>
        </div>
      )}
    />
  )
}
