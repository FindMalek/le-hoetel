import { isForbidden } from "@ritorno/orpc/errors"
import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { MegaphoneIcon, PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CampaignsList } from "@/components/campaigns-list"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Campaigns" }

export default async function CampaignsPage() {
  const t = await getTranslations("campaigns")
  const queryClient = getQueryClient()
  // Not `prefetchQuery`: it swallows the refusal, and the list then fetches during the server render and never loads.
  const allowed = await call(() => queryClient.fetchQuery(serverOrpc.campaigns.list.queryOptions())).then(
    () => true,
    (error) => {
      if (isForbidden(error)) return false
      throw error
    },
  )
  if (!allowed) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <div className="p-4 md:p-6">
          <PageState
            kind="forbidden"
            icon={<MegaphoneIcon />}
            title={t("forbiddenTitle")}
            description={t("forbiddenBody")}
          />
        </div>
      </>
    )
  }
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button render={<Link href="/campaigns/new" />} nativeButton={false}>
            <PlusIcon data-icon="inline-start" />
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
