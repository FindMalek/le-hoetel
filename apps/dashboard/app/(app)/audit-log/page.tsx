import { ADMIN_LIST_LIMIT } from "@ritorno/common/constants"
import { Button } from "@ritorno/ui/components/button"
import { type DataColumn, DataTable } from "@ritorno/ui/components/data-table"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { Input } from "@ritorno/ui/components/input"
import { Label } from "@ritorno/ui/components/label"
import { HistoryIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { selectClass } from "@/components/admin-fields"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
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

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams
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
    t.has(`actions.${action}` as never) ? t(`actions.${action}` as never) : action
  const href = (next: number) => {
    const query = new URLSearchParams(
      Object.entries({ ...params, offset: String(next) }).filter(([, value]) => value) as [string, string][],
    )
    return `/audit-log?${query}`
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
  const columns: DataColumn<Entry>[] = [
    {
      id: "action",
      header: t("columns.action"),
      cell: (entry) => <span className="font-medium">{actionLabel(entry.action)}</span>,
    },
    { id: "who", header: t("columns.who"), cell: (entry) => <span dir="ltr">{who(entry)}</span> },
    { id: "hotel", header: t("columns.hotel"), cell: hotelCell, showFrom: "lg" },
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
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor="audit-action">{t("filters.action")}</Label>
            <select id="audit-action" name="action" defaultValue={params.action ?? ""} className={selectClass}>
              <option value="">{t("filters.any")}</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {actionLabel(action)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor="audit-actor">{t("filters.actor")}</Label>
            <select id="audit-actor" name="actor" defaultValue={params.actor ?? ""} className={selectClass}>
              <option value="">{t("filters.any")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="audit-hotel">{t("filters.hotel")}</Label>
            <select id="audit-hotel" name="hotel" defaultValue={params.hotel ?? ""} className={selectClass}>
              <option value="">{t("filters.any")}</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor="audit-from">{t("filters.from")}</Label>
            <Input id="audit-from" name="from" type="date" dir="ltr" defaultValue={params.from ?? ""} />
          </div>
          <div className="grid gap-1.5 lg:col-span-2">
            <Label htmlFor="audit-to">{t("filters.to")}</Label>
            <Input id="audit-to" name="to" type="date" dir="ltr" defaultValue={params.to ?? ""} />
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
            <Button type="submit" className="flex-1">
              {t("filters.apply")}
            </Button>
            {filtered && (
              <Button variant="outline" render={<Link href="/audit-log" />} nativeButton={false}>
                {t("filters.reset")}
              </Button>
            )}
          </div>
        </form>

        <DataTable
          caption={t("title")}
          rows={entries}
          columns={columns}
          getRowKey={(entry) => entry.id}
          empty={
            <EmptyState
              icon={<HistoryIcon />}
              title={filtered ? t("noMatch.title") : t("empty.title")}
              description={filtered ? t("noMatch.description") : t("empty.description")}
            />
          }
          card={(entry) => (
            <div className="flex flex-col gap-1">
              <p className="font-medium">{actionLabel(entry.action)}</p>
              <p className="text-muted-foreground text-sm" dir="ltr">
                {who(entry)}
              </p>
              <p className="flex items-center justify-between gap-3 text-sm">
                {hotelCell(entry)}
                <span className="text-muted-foreground text-xs">
                  <LocalDate value={entry.createdAt} time />
                </span>
              </p>
            </div>
          )}
          footer={
            offset > 0 || hasMore ? (
              <div className="flex items-center justify-between gap-3">
                {offset > 0 ? (
                  <Button
                    variant="outline"
                    render={<Link href={href(Math.max(0, offset - ADMIN_LIST_LIMIT)) as never} />}
                    nativeButton={false}
                  >
                    {t("newer")}
                  </Button>
                ) : (
                  <span />
                )}
                {hasMore && (
                  <Button
                    variant="outline"
                    render={<Link href={href(offset + ADMIN_LIST_LIMIT) as never} />}
                    nativeButton={false}
                  >
                    {t("older")}
                  </Button>
                )}
              </div>
            ) : null
          }
        />
      </div>
    </>
  )
}
