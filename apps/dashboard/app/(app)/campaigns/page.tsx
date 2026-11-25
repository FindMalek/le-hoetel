import { Button } from "@ritorno/ui/components/button"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CampaignsList } from "@/components/campaigns-list"
import { PageHeader } from "@/components/page-header"
import { getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Campaigns" }

export default async function CampaignsPage() {
  const t = await getTranslations("campaigns")
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(serverOrpc.campaigns.list.queryOptions())
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button className="h-11 md:h-9" render={<Link href="/campaigns/new" />} nativeButton={false}>
            <PlusIcon />
            {t("new")}
          </Button>
        }
      />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CampaignsList />
        </HydrationBoundary>
      </div>
    </>
  )
}
