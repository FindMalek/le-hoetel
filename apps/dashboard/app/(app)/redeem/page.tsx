import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { RedeemScreen } from "@/components/redeem-screen"
import { getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Redeem" }

export default async function RedeemPage() {
  const t = await getTranslations("redeem")
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(serverOrpc.offers.redemptionStats.queryOptions())
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="mx-auto max-w-xl p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RedeemScreen />
        </HydrationBoundary>
      </div>
    </>
  )
}
