import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { RedeemScreen } from "@/components/redeem-screen"
import { currentHotel, getQueryClient, serverOrpc } from "@/lib/api"
import { redemptionStats, redemptionsList } from "@/lib/lists"

export const metadata: Metadata = { title: "Redeem" }

export default async function RedeemPage() {
  const queryClient = getQueryClient()
  const [t, hotel] = await Promise.all([getTranslations("redeem"), currentHotel()])
  const hotelId = hotel?.id ?? ""
  await Promise.all([
    queryClient.prefetchQuery(redemptionStats(serverOrpc, hotelId)),
    queryClient.prefetchInfiniteQuery(redemptionsList(serverOrpc, hotelId)),
  ])
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="mx-auto max-w-xl p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RedeemScreen hotelId={hotelId} timeZone={hotel?.timezone} />
        </HydrationBoundary>
      </div>
    </>
  )
}
