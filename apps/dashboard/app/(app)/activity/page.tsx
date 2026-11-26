import { isForbidden } from "@ritorno/orpc/errors"
import { PageState } from "@ritorno/ui/components/page-state"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { HistoryIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { HotelAuditFeed } from "@/components/audit-feed"
import { AuditFilters } from "@/components/audit-filters"
import { PageHeader } from "@/components/page-header"
import { call, currentHotel, getQueryClient, serverOrpc } from "@/lib/api"
import { actionLabel, hotelAuditPages, picked, urlDay } from "@/lib/audit"

export const metadata: Metadata = { title: "Activity log" }

interface Params {
  action?: string
  actor?: string
  from?: string
  to?: string
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  await connection()
  const raw = await searchParams
  const values: Params = {
    action: picked(raw.action),
    actor: picked(raw.actor),
    from: urlDay(raw.from),
    to: urlDay(raw.to),
  }
  const filter = { action: values.action, actorId: values.actor, from: values.from, to: values.to }
  const [t, hotel, options] = await Promise.all([
    getTranslations("adminAudit"),
    currentHotel(),
    call((api) => api.audit.filters()).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
  ])
  const header = <PageHeader title={t("hotel.title")} description={t("hotel.description")} />

  if (!options || !hotel) {
    return (
      <>
        {header}
        <div className="p-4 md:p-6">
          <PageState kind="forbidden" icon={<HistoryIcon />} title={t("hotel.forbidden")} />
        </div>
      </>
    )
  }

  const queryClient = getQueryClient()
  await queryClient.prefetchInfiniteQuery(hotelAuditPages(serverOrpc, hotel.id, filter))
  const filtered = Object.values(values).some(Boolean)

  return (
    <>
      {header}
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <HotelAuditFeed
            hotelId={hotel.id}
            filter={filter}
            timeZone={options.timezone}
            filtered={filtered}
            resetHref="/activity"
            filters={
              <AuditFilters
                actions={options.actions.map((action) => ({ value: action, label: actionLabel(t, action) }))}
                actors={options.actors.map((actor) => ({ value: actor.id, label: actor.email }))}
                values={values}
                filtered={filtered}
                resetHref="/activity"
              />
            }
          />
        </HydrationBoundary>
      </div>
    </>
  )
}
