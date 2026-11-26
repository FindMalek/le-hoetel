import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CampaignForm } from "@/components/campaign-form"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"
import { getCampaignPreviewCopies } from "@/lib/preview-copy"

export const metadata: Metadata = { title: "New campaign" }

export default async function NewCampaignPage() {
  const t = await getTranslations("campaigns")
  const queryClient = getQueryClient()
  const [hotel, copies] = await Promise.all([
    call((api) => api.hotel.get()),
    getCampaignPreviewCopies(),
    queryClient.prefetchQuery(serverOrpc.offers.list.queryOptions()),
  ])
  return (
    <>
      <PageHeader title={t("form.newTitle")} description={t("form.hint")} />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CampaignForm defaultLanguage={hotel.defaultLanguage} hotelName={hotel.displayName} copies={copies} />
        </HydrationBoundary>
      </div>
    </>
  )
}
