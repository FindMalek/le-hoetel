import { isForbidden } from "@ritorno/orpc/errors"
import { PageState } from "@ritorno/ui/components/page-state"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { CalendarHeartIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HolidaysBoard } from "@/components/holidays-board"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Holiday messages" }

export default async function HolidaysPage() {
  const t = await getTranslations("holidays")
  const queryClient = getQueryClient()
  // Not `prefetchQuery`: it swallows the refusal, and the board then fetches during the server render and never loads.
  const [hotel, allowed] = await Promise.all([
    call((api) => api.hotel.get()),
    call(() => queryClient.fetchQuery(serverOrpc.holidays.list.queryOptions())).then(
      () => true,
      (error) => {
        if (isForbidden(error)) return false
        throw error
      },
    ),
  ])
  if (!allowed) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <div className="p-4 md:p-6">
          <PageState
            kind="forbidden"
            icon={<CalendarHeartIcon />}
            title={t("forbiddenTitle")}
            description={t("forbiddenBody")}
          />
        </div>
      </>
    )
  }
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <HolidaysBoard hotelName={hotel.displayName} defaultLanguage={hotel.defaultLanguage} />
        </HydrationBoundary>
        <p className="mt-6 max-w-prose text-muted-foreground text-sm">{t("footnote")}</p>
      </div>
    </>
  )
}
