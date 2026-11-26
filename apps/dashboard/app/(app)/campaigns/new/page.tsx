import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CampaignForm } from "@/components/campaign-form"
import { CampaignsForbidden } from "@/components/campaigns-forbidden"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, hotelRole, serverOrpc } from "@/lib/api"
import { getCampaignPreviewCopies } from "@/lib/preview-copy"
import { allows } from "@/lib/viewer"

export const metadata: Metadata = { title: "New campaign" }

export default async function NewCampaignPage() {
  const t = await getTranslations("campaigns")
  if (!allows(await hotelRole(), { campaign: ["create"] })) return <CampaignsForbidden />
  const queryClient = getQueryClient()
  // `fetchQuery`, not `prefetchQuery`: a swallowed failure leaves the suspense query loading forever.
  const [hotel, copies] = await Promise.all([
    call((api) => api.hotel.get()),
    getCampaignPreviewCopies(),
    call(() => queryClient.fetchQuery(serverOrpc.offers.list.queryOptions())),
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
