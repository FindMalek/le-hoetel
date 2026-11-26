import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { CampaignForm } from "@/components/campaign-form"
import { CampaignsForbidden } from "@/components/campaigns-forbidden"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, hotelRole, serverOrpc } from "@/lib/api"
import { getCampaignPreviewCopies } from "@/lib/preview-copy"
import { allows } from "@/lib/viewer"

export const metadata: Metadata = { title: "Edit campaign" }

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations("campaigns")
  if (!allows(await hotelRole(), { campaign: ["update"] })) return <CampaignsForbidden />
  const queryClient = getQueryClient()
  // `fetchQuery`, not `prefetchQuery`: a swallowed failure leaves the suspense query loading forever.
  const [hotel, copies, campaign] = await Promise.all([
    call((api) => api.hotel.get()),
    getCampaignPreviewCopies(),
    call((api) => api.campaigns.get({ id })),
    call(() => queryClient.fetchQuery(serverOrpc.offers.list.queryOptions())),
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
