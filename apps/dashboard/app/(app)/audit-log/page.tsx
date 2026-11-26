import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AdminAuditFeed } from "@/components/audit-feed"
import { AuditFilters } from "@/components/audit-filters"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"
import { actionLabel, adminAuditPages, picked, urlDay } from "@/lib/audit"

export const metadata: Metadata = { title: "Audit log" }

interface Params {
  action?: string
  actor?: string
  hotel?: string
  from?: string
  to?: string
}

const DAY_MS = 86_400_000

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams
  const values: Params = {
    action: picked(raw.action),
    actor: picked(raw.actor),
    hotel: picked(raw.hotel),
    from: urlDay(raw.from),
    to: urlDay(raw.to),
  }
  const filter = {
    action: values.action,
    actorId: values.actor,
    hotelId: values.hotel,
    from: values.from ? new Date(`${values.from}T00:00:00Z`) : undefined,
    to: values.to ? new Date(new Date(`${values.to}T00:00:00Z`).getTime() + DAY_MS) : undefined,
  }
  const queryClient = getQueryClient()
  const [t, actions, { users }, hotels] = await Promise.all([
    getTranslations("adminAudit"),
    call((api) => api.admin.audit.actions()),
    call((api) => api.admin.users()),
    call((api) => api.admin.hotels.list()),
    queryClient.prefetchInfiniteQuery(adminAuditPages(serverOrpc, filter)),
  ])
  const filtered = Object.values(values).some(Boolean)

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AdminAuditFeed
            filter={filter}
            filtered={filtered}
            resetHref="/audit-log"
            filters={
              <AuditFilters
                actions={actions.map((action) => ({ value: action, label: actionLabel(t, action) }))}
                actors={users.map((user) => ({ value: user.id, label: user.email }))}
                hotels={hotels.map((hotel) => ({ value: hotel.id, label: hotel.displayName }))}
                values={values}
                filtered={filtered}
                resetHref="/audit-log"
              />
            }
          />
        </HydrationBoundary>
      </div>
    </>
  )
}
