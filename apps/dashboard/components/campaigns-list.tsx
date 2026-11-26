"use client"

// i18n-used: campaigns
import type { Campaign } from "@ritorno/common/campaigns"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { Num } from "@ritorno/ui/components/num"
import { PageState } from "@ritorno/ui/components/page-state"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { ClockIcon, LoaderIcon, MegaphoneIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

/** A sent campaign where every message failed reads as failed, the api has no such status. */
export type CampaignState = Campaign["status"] | "failed"

export const campaignState = (campaign: Campaign): CampaignState =>
  campaign.status === "sent" && campaign.results.failed > 0 && campaign.results.sent + campaign.results.delivered === 0
    ? "failed"
    : campaign.status

const STATE_TONE: Record<CampaignState, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  sending: "info",
  sent: "success",
  failed: "danger",
  cancelled: "neutral",
}

export function CampaignStatusBadge({ campaign }: { campaign: Campaign }) {
  const t = useTranslations("campaigns")
  const state = campaignState(campaign)
  const icon =
    state === "sending" ? (
      <LoaderIcon className="motion-safe:animate-spin" />
    ) : state === "scheduled" ? (
      <ClockIcon />
    ) : undefined
  return (
    <StatusBadge tone={STATE_TONE[state]} icon={icon}>
      {t(`status.${state}`)}
    </StatusBadge>
  )
}

/** Guests it would reach today while it can still change, the guests it reached out to once it went out. */
export function useAudience(campaign: Campaign): number | null {
  const live = campaign.status === "draft" || campaign.status === "scheduled"
  const preview = useQuery(
    orpc.campaigns.preview.queryOptions({
      input: { channel: campaign.channel, segment: campaign.segment },
      enabled: live,
    }),
  )
  if (!live) return campaign.results.targeted
  return preview.data?.guests ?? null
}

function Audience({ campaign }: { campaign: Campaign }) {
  const t = useTranslations("campaigns")
  const locale = useLocale()
  const guests = useAudience(campaign)
  if (guests === null) return <span className="text-muted-foreground">{t("counting")}</span>
  return (
    <span className="tabular-nums">
      {t.rich("guests", { count: guests, n: () => <Num value={guests} locale={locale} /> })}
    </span>
  )
}

const FILTERS = ["all", "draft", "scheduled", "sent"] as const
type Filter = (typeof FILTERS)[number]

const FILTER_STATUSES: Record<Exclude<Filter, "all">, Campaign["status"][]> = {
  draft: ["draft"],
  scheduled: ["scheduled", "sending"],
  sent: ["sent", "cancelled"],
}

const inFilter = (campaign: Campaign, filter: Filter): boolean =>
  filter === "all" || FILTER_STATUSES[filter].includes(campaign.status)

export function CampaignsList() {
  const t = useTranslations("campaigns")
  const locale = useLocale()
  const { data: campaigns } = useSuspenseQuery(orpc.campaigns.list.queryOptions())
  const [filter, setFilter] = useState<Filter>("all")

  if (!campaigns.length) {
    return (
      <PageState
        kind="empty"
        firstRun
        icon={<MegaphoneIcon />}
        title={t("empty")}
        description={t("emptyHint")}
        action={
          <Button render={<Link href="/campaigns/new" />} nativeButton={false}>
            <PlusIcon data-icon="inline-start" />
            {t("new")}
          </Button>
        }
      />
    )
  }

  const when = (campaign: Campaign) => {
    const key = campaign.completedAt ? "sentOn" : campaign.scheduledAt ? "scheduledFor" : "createdOn"
    const date = campaign.completedAt ?? campaign.scheduledAt ?? campaign.createdAt
    return t(`when.${key}`, { date: new Date(date).toLocaleDateString(locale, { dateStyle: "medium" }) })
  }
  const name = (campaign: Campaign) => (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="inline-flex min-h-11 items-center font-medium hover:underline md:min-h-0"
    >
      {campaign.name}
    </Link>
  )
  const results = (campaign: Campaign) =>
    campaign.results.targeted ? (
      <span className="flex flex-col items-end tabular-nums">
        <span>
          {t.rich("resultsLine", {
            sent: () => <Num value={campaign.results.sent + campaign.results.delivered} locale={locale} />,
            total: () => <Num value={campaign.results.targeted} locale={locale} />,
          })}
        </span>
        {campaign.results.failed ? (
          <span className="text-destructive text-xs">
            {t.rich("failedLine", {
              count: campaign.results.failed,
              n: () => <Num value={campaign.results.failed} locale={locale} />,
            })}
          </span>
        ) : null}
      </span>
    ) : (
      <span className="text-muted-foreground">{t("notSentYet")}</span>
    )

  const columns: DataColumn<Campaign>[] = [
    { id: "name", header: t("columns.name"), cell: name },
    { id: "status", header: t("columns.status"), cell: (campaign) => <CampaignStatusBadge campaign={campaign} /> },
    {
      id: "channel",
      header: t("columns.channel"),
      showFrom: "lg",
      cell: (campaign) => t(`channel.${campaign.channel}`),
    },
    {
      id: "audience",
      header: t("columns.audience"),
      align: "end",
      cell: (campaign) => <Audience campaign={campaign} />,
    },
    { id: "results", header: t("columns.results"), align: "end", showFrom: "lg", cell: results },
    { id: "when", header: t("columns.when"), align: "end", showFrom: "md", cell: when },
  ]
  const count = (value: Filter) => campaigns.filter((campaign) => inFilter(campaign, value)).length

  return (
    <DataList
      caption={t("title")}
      filters={
        <SegmentedControl
          label={t("filterLabel")}
          className="max-w-full overflow-x-auto"
          value={filter}
          onValueChange={setFilter}
          options={FILTERS.map((value) => ({
            value,
            label: (
              <>
                {t(`filter.${value}`)}
                <Num value={count(value)} locale={locale} className="text-muted-foreground tabular-nums" />
              </>
            ),
          }))}
        />
      }
      rows={campaigns.filter((campaign) => inFilter(campaign, filter))}
      columns={columns}
      getRowKey={(campaign) => campaign.id}
      card={(campaign) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            {name(campaign)}
            <CampaignStatusBadge campaign={campaign} />
          </div>
          <p className="flex flex-wrap items-center justify-between gap-x-3 text-muted-foreground text-sm">
            <span>{t(`channel.${campaign.channel}`)}</span>
            <Audience campaign={campaign} />
          </p>
          <p className="text-muted-foreground text-xs">{when(campaign)}</p>
        </div>
      )}
      empty={<PageState kind="empty" title={t("filterEmpty")} />}
    />
  )
}
