import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OffersBoard } from "@/components/offers-board"
import { PageHeader } from "@/components/page-header"
import { TopBarAction } from "@/components/top-bar"
import { call, getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Offers" }

export default async function OffersPage() {
  const t = await getTranslations("offers")
  const queryClient = getQueryClient()
  const [mine] = await Promise.all([
    call((api) => api.hotel.mine()),
    queryClient.prefetchQuery(serverOrpc.offers.list.queryOptions()),
    queryClient.prefetchQuery(serverOrpc.offers.redemptionStats.queryOptions()),
  ])
  const canEdit = mine.role !== "staff"
  return (
    <>
      {canEdit ? <TopBarAction href="/offers/new" label={t("add")} icon={<PlusIcon />} /> : null}
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <OffersBoard canEdit={canEdit} />
        </HydrationBoundary>
      </div>
    </>
  )
}
