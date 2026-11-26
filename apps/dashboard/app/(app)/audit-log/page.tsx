import { ADMIN_LIST_LIMIT } from "@ritorno/common/constants"
import { Button } from "@ritorno/ui/components/button"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { PageState } from "@ritorno/ui/components/page-state"
import { HistoryIcon, SearchXIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { AdminAuditFilters } from "@/components/admin-audit-filters"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
import { AUDIT_ALL } from "@/lib/admin"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Audit log" }

interface Params {
  action?: string
  actor?: string
  hotel?: string
  from?: string
  to?: string
  offset?: string
}

const DAY_MS = 86_400_000

const picked = (value: string | undefined): string | undefined => (value && value !== AUDIT_ALL ? value : undefined)

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams
  const params: Params = { ...raw, action: picked(raw.action), actor: picked(raw.actor), hotel: picked(raw.hotel) }
  const offset = Math.max(0, Number(params.offset) || 0)
  const from = params.from ? new Date(`${params.from}T00:00:00Z`) : undefined
  const to = params.to ? new Date(new Date(`${params.to}T00:00:00Z`).getTime() + DAY_MS) : undefined
  const [t, { entries, hasMore }, actions, { users }, hotels] = await Promise.all([
    getTranslations("adminAudit"),
    call((api) =>
      api.admin.audit.list({
        action: params.action,
        actorId: params.actor,
        hotelId: params.hotel,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
        offset,
      }),
    ),
    call((api) => api.admin.audit.actions()),
    call((api) => api.admin.users()),
    call((api) => api.admin.hotels.list()),
  ])
  const filtered = Boolean(params.action || params.actor || params.hotel || params.from || params.to)

  const actionLabel = (action: string) =>
    t.has(`actions.${action}` as never) ? t(`actions.${action}` as never) : action.replace(/[._-]+/g, " ")
  const href = (next: number) => {
    const query = new URLSearchParams(
      Object.entries({ ...params, offset: next ? String(next) : undefined }).filter(([, value]) => value) as [
        string,
        string,
      ][],
    )
    return `/audit-log${query.size ? `?${query}` : ""}`
  }

  type Entry = (typeof entries)[number]
  const hotelCell = (entry: Entry) =>
    entry.hotelId && entry.hotelName ? (
      <Link href={`/admin/hotels/${entry.hotelId}`} className="underline-offset-4 hover:underline">
        {entry.hotelName}
      </Link>
    ) : (
      <span className="text-muted-foreground">–</span>
    )
  const who = (entry: Entry) => entry.actorEmail ?? t("system")
  /** Hotel targets show as the hotel. Other targets (a guest, an offer, a user) only by a short id: the log stores no names. */
  const target = (entry: Entry) =>
    entry.targetId && entry.targetId !== entry.hotelId ? (
      <code className="text-caption text-muted-foreground" dir="ltr" title={entry.targetId}>
        #{entry.targetId.slice(0, 8)}
      </code>
    ) : null
  const columns: DataColumn<Entry>[] = [
    {
      id: "action",
      header: t("columns.action"),
      cell: (entry) => <span className="font-medium">{actionLabel(entry.action)}</span>,
    },
    { id: "who", header: t("columns.who"), cell: (entry) => <span dir="ltr">{who(entry)}</span> },
    {
      id: "target",
      header: t("columns.target"),
      cell: (entry) => (
        <span className="flex flex-wrap items-center gap-x-2">
          {entry.hotelName || !entry.targetId ? hotelCell(entry) : null}
          {target(entry)}
        </span>
      ),
      showFrom: "lg",
    },
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
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <DataList
          caption={t("title")}
          rows={entries}
          columns={columns}
          getRowKey={(entry) => entry.id}
          linkComponent={Link}
          filters={
            <AdminAuditFilters
              actions={actions.map((action) => ({ value: action, label: actionLabel(action) }))}
              actors={users.map((user) => ({ value: user.id, label: user.email }))}
              hotels={hotels.map((hotel) => ({ value: hotel.id, label: hotel.displayName }))}
              values={params}
              filtered={filtered}
            />
          }
          empty={
            filtered ? (
              <PageState
                kind="empty"
                icon={<SearchXIcon />}
                title={t("noMatch.title")}
                description={t("noMatch.description")}
                action={
                  <Button variant="outline" render={<Link href="/audit-log" />} nativeButton={false}>
                    {t("filters.reset")}
                  </Button>
                }
              />
            ) : (
              <PageState
                kind="empty"
                icon={<HistoryIcon />}
                title={t("empty.title")}
                description={t("empty.description")}
              />
            )
          }
          card={(entry) => (
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">{actionLabel(entry.action)}</p>
              <p className="truncate text-muted-foreground text-small" dir="ltr">
                {who(entry)}
              </p>
              <div className="flex items-center justify-between gap-3 text-small">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2">
                  {entry.hotelName || !entry.targetId ? hotelCell(entry) : null}
                  {target(entry)}
                </span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  <LocalDate value={entry.createdAt} time />
                </span>
              </div>
            </div>
          )}
          pagination={{
            previousLabel: t("newer"),
            nextLabel: t("older"),
            previous: offset > 0 ? { href: href(Math.max(0, offset - ADMIN_LIST_LIMIT)) } : undefined,
            next: hasMore ? { href: href(offset + ADMIN_LIST_LIMIT) } : undefined,
            status: entries.length ? t("range", { from: offset + 1, to: offset + entries.length }) : undefined,
          }}
        />
      </div>
    </>
  )
}
