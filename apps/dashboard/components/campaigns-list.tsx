"use client"

// i18n-used: campaigns
import type { Campaign } from "@le-hoetel/common/campaigns"
import { orpc } from "@le-hoetel/orpc/react"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Button } from "@le-hoetel/ui/components/button"
import { DataTable } from "@le-hoetel/ui/components/data-table"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { useSuspenseQuery } from "@tanstack/react-query"
import { MegaphoneIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

export function CampaignStatusBadge({ status }: { status: Campaign["status"] }) {
  const t = useTranslations("campaigns")
  return (
    <Badge variant={status === "sent" ? "default" : status === "cancelled" ? "destructive" : "secondary"}>
      {t(`status.${status}`)}
    </Badge>
  )
}

export function CampaignsList() {
  const t = useTranslations("campaigns")
  const locale = useLocale()
  const { data: campaigns } = useSuspenseQuery(orpc.campaigns.list.queryOptions())
  const when = (campaign: Campaign) => {
    const date = campaign.completedAt ?? campaign.scheduledAt ?? campaign.createdAt
    return new Date(date).toLocaleDateString(locale, { dateStyle: "medium" })
  }
  return (
    <DataTable
      caption={t("title")}
      rows={campaigns}
      getRowKey={(campaign) => campaign.id}
      empty={
        <EmptyState
          decorated
          icon={<MegaphoneIcon />}
          title={t("empty")}
          description={t("emptyHint")}
          action={
            <Button className="h-11" render={<Link href="/campaigns/new" />} nativeButton={false}>
              <PlusIcon />
              {t("new")}
            </Button>
          }
        />
      }
      columns={[
        {
          id: "name",
          header: t("columns.name"),
          cell: (campaign) => (
            <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">
              {campaign.name}
            </Link>
          ),
        },
        {
          id: "status",
          header: t("columns.status"),
          cell: (campaign) => <CampaignStatusBadge status={campaign.status} />,
        },
        {
          id: "channel",
          header: t("columns.channel"),
          showFrom: "md",
          cell: (campaign) => t(`channel.${campaign.channel}`),
        },
        {
          id: "results",
          header: t("columns.results"),
          align: "end",
          cell: (campaign) =>
            campaign.results.targeted
              ? t("resultsLine", {
                  sent: campaign.results.sent + campaign.results.delivered,
                  total: campaign.results.targeted,
                })
              : "–",
        },
        { id: "when", header: t("columns.when"), align: "end", showFrom: "lg", cell: when },
      ]}
    />
  )
}
