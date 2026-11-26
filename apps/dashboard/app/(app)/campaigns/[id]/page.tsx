import { Button } from "@ritorno/ui/components/button"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CampaignDetail } from "@/components/campaign-detail"
import { CampaignsForbidden } from "@/components/campaigns-forbidden"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, hotelRole, serverOrpc } from "@/lib/api"
import { getCampaignPreviewCopies } from "@/lib/preview-copy"
import { allows } from "@/lib/viewer"

export const metadata: Metadata = { title: "Campaign" }

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations("campaigns")
  if (!allows(await hotelRole(), { campaign: ["read"] })) return <CampaignsForbidden />
  const queryClient = getQueryClient()
  const [campaign, hotel, copies] = await Promise.all([
    queryClient.fetchQuery(serverOrpc.campaigns.get.queryOptions({ input: { id } })),
    call((api) => api.hotel.get()),
    getCampaignPreviewCopies(),
  ])
  return (
    <>
      <PageHeader
        title={campaign.name}
        description={campaign.status === "draft" ? t("detail.description") : undefined}
        secondaryActions={
          campaign.status === "draft" ? (
            <Button variant="outline" render={<Link href={`/campaigns/${id}/edit`} />} nativeButton={false}>
              <PencilIcon data-icon="inline-start" />
              {t("detail.edit")}
            </Button>
          ) : null
        }
      />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CampaignDetail
            id={id}
            hotelName={hotel.displayName}
            defaultLanguage={hotel.defaultLanguage}
            copies={copies}
          />
        </HydrationBoundary>
      </div>
    </>
  )
}
