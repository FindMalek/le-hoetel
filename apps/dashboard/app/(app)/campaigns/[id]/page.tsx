import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CampaignDetail } from "@/components/campaign-detail"
import { PageHeader } from "@/components/page-header"
import { getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Campaign" }

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations("campaigns")
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(serverOrpc.campaigns.get.queryOptions({ input: { id } }))
  return (
    <>
      <PageHeader title={t("detail.title")} description={t("detail.description")} />
      <div className="max-w-4xl p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CampaignDetail id={id} />
        </HydrationBoundary>
      </div>
    </>
  )
}
