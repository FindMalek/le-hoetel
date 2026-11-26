"use client"

import { FEEDBACK_CASE_STATUSES, type FeedbackCaseStatus } from "@ritorno/common/feedback-case"
import { orpc } from "@ritorno/orpc/react"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { PageState } from "@ritorno/ui/components/page-state"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { formatDate } from "@ritorno/ui/lib/date"
import { formatNumber } from "@ritorno/ui/lib/number"
import { useInfiniteQuery } from "@tanstack/react-query"
import { ChevronRightIcon, SmileIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { CaseStatusBadge, ScoreBadge } from "@/components/feedback-case-badges"
import { LoadMore } from "@/components/load-more"
import { feedbackCasesList } from "@/lib/lists"

const listHref = (status: FeedbackCaseStatus | undefined) => (status ? `/feedback?status=${status}` : "/feedback")

type FeedbackCasesListProps = { hotelId: string; status?: FeedbackCaseStatus; timeZone: string }

export function FeedbackCasesList({ hotelId, status, timeZone }: FeedbackCasesListProps) {
  const t = useTranslations("feedbackCases")
  const tList = useTranslations("loadMore")
  const locale = useLocale()
  const list = useInfiniteQuery(feedbackCasesList(orpc, hotelId, { status }))
  const items = list.data?.pages.flatMap((page) => page.items) ?? []
  const latest = list.data?.pages.at(-1)
  const counts = latest?.counts ?? { new: 0, contacted: 0, resolved: 0 }
  const all = counts.new + counts.contacted + counts.resolved
  const date = (value: Date) => formatDate(value, locale, timeZone)
  const comment = (value: string | null) => (
    <span dir="auto" className="line-clamp-2 text-start text-muted-foreground">
      {value ?? t("noComment")}
    </span>
  )
  const option = (value: FeedbackCaseStatus | "all", label: string, n: number) => ({
    value,
    href: listHref(value === "all" ? undefined : value),
    label: (
      <>
        {label}
        <bdi dir="ltr" className="text-muted-foreground tabular-nums">
          {formatNumber(n, locale)}
        </bdi>
      </>
    ),
  })

  const columns: DataColumn<(typeof items)[number]>[] = [
    {
      id: "guest",
      header: t("columns.guest"),
      cell: (item) => (
        <Link
          href={`/feedback/${item.id}`}
          className="font-medium underline-offset-4 hover:underline focus-visible:underline"
        >
          {item.name}
        </Link>
      ),
    },
    { id: "score", header: t("columns.score"), cell: (item) => <ScoreBadge nps={item.nps} /> },
    { id: "comment", header: t("columns.comment"), className: "w-2/5", cell: (item) => comment(item.comment) },
    { id: "status", header: t("columns.status"), cell: (item) => <CaseStatusBadge status={item.status} /> },
    {
      id: "date",
      header: t("columns.date"),
      align: "end",
      showFrom: "lg",
      cell: (item) => <span className="whitespace-nowrap text-muted-foreground">{date(item.createdAt)}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <DataList
        caption={t("caption")}
        columns={columns}
        rows={items}
        loading={list.isPending ? { label: t("caption") } : undefined}
        getRowKey={(item) => item.id}
        linkComponent={Link}
        filters={
          all > 0 ? (
            <div className="-mx-1 max-w-full overflow-x-auto px-1 py-1">
              <SegmentedControl
                className="max-sm:*:flex-none max-sm:*:px-2.5"
                label={t("columns.status")}
                linkComponent={Link}
                value={status ?? "all"}
                options={[
                  option("all", t("all"), all),
                  ...FEEDBACK_CASE_STATUSES.map((value) => option(value, t(`status.${value}`), counts[value])),
                ]}
              />
            </div>
          ) : null
        }
        empty={
          list.isError ? (
            <PageState kind="error" title={tList("failed")} />
          ) : all > 0 ? (
            <PageState kind="empty" icon={<SmileIcon />} title={t("noMatchTitle")} description={t("noMatchBody")} />
          ) : (
            <PageState kind="empty" icon={<SmileIcon />} title={t("emptyTitle")} description={t("emptyBody")} />
          )
        }
        card={(item) => (
          <Link href={`/feedback/${item.id}`} className="-m-4 flex min-h-11 items-center gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{item.name}</span>
                <span className="shrink-0 text-muted-foreground text-xs">{date(item.createdAt)}</span>
              </span>
              <span className="text-sm">{comment(item.comment)}</span>
              <span className="flex flex-wrap gap-2">
                <ScoreBadge nps={item.nps} />
                <CaseStatusBadge status={item.status} />
              </span>
            </div>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
          </Link>
        )}
      />
      <LoadMore query={list} shown={items.length} total={latest?.total} />
    </div>
  )
}
