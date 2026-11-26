import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HolidaysBoard } from "@/components/holidays-board"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Holiday messages" }

export default async function HolidaysPage() {
  const t = await getTranslations("holidays")
  const queryClient = getQueryClient()
  const [hotel] = await Promise.all([
    call((api) => api.hotel.get()),
    queryClient.prefetchQuery(serverOrpc.holidays.list.queryOptions()),
  ])
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
