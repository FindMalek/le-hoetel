import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CampaignForm } from "@/components/campaign-form"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"
import { getCampaignPreviewCopies } from "@/lib/preview-copy"

export const metadata: Metadata = { title: "Edit campaign" }

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations("campaigns")
  const queryClient = getQueryClient()
  const [hotel, copies, campaign] = await Promise.all([
    call((api) => api.hotel.get()),
    getCampaignPreviewCopies(),
    call((api) => api.campaigns.get({ id })),
    queryClient.prefetchQuery(serverOrpc.offers.list.queryOptions()),
  ])
  if (campaign.status !== "draft") redirect(`/campaigns/${id}`)
  return (
    <>
      <PageHeader title={t("form.editTitle")} description={t("form.hint")} />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CampaignForm
            defaultLanguage={hotel.defaultLanguage}
            hotelName={hotel.displayName}
            copies={copies}
            campaign={campaign}
          />
        </HydrationBoundary>
      </div>
    </>
  )
}
