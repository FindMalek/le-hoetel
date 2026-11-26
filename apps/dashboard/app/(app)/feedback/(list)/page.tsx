import { FEEDBACK_CASE_STATUSES, type FeedbackCaseStatus } from "@ritorno/common/feedback-case"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { PageState } from "@ritorno/ui/components/page-state"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { formatDate } from "@ritorno/ui/lib/date"
import { formatNumber } from "@ritorno/ui/lib/number"
import { pageWindow } from "@ritorno/ui/lib/pagination"
import { ChevronRightIcon, SmileIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { CaseStatusBadge, ScoreBadge } from "@/components/feedback-case-badges"
import { InboxTabs } from "@/components/inbox-tabs"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

const PAGE_SIZE = 25

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav")
  return { title: t("unhappyGuests") }
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const listHref = (status: FeedbackCaseStatus | undefined, page = 1) => {
  const params = new URLSearchParams()
  if (status) params.set("status", status)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `/feedback?${query}` : "/feedback"
}

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const raw = await searchParams
  const status = FEEDBACK_CASE_STATUSES.find((value) => value === first(raw.status))
  const current = Math.max(1, Math.trunc(Number(first(raw.page)) || 1))
  const [t, tInbox, locale, { activeId }] = await Promise.all([
    getTranslations("feedbackCases"),
    getTranslations("inbox"),
    getLocale(),
    call((api) => api.hotel.mine()),
  ])
  if (!activeId) {
    return (
      <>
        <PageHeader title={tInbox("title")} />
        <div className="flex flex-col gap-4 p-4 md:p-6">
          <InboxTabs current="/feedback" />
          <PageState kind="empty" icon={<SmileIcon />} title={t("noHotelTitle")} description={t("noHotelBody")} />
        </div>
      </>
    )
  }

  const load = (page: number) =>
    call((api) => api.feedbackCases.list({ status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }))
  const [asked, hotel] = await Promise.all([load(current), call((api) => api.hotel.get())])
  const pages = pageWindow({ page: current, pageSize: PAGE_SIZE, total: asked.total })
  // A page past the end (an old link, cases that moved on) shows the last one.
  const { items, counts } = pages.page === current ? asked : await load(pages.page)
  const all = counts.new + counts.contacted + counts.resolved
  const date = (value: Date) => formatDate(value, locale, hotel.timezone)
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
    <>
      <PageHeader title={tInbox("title")} description={t("waiting", { count: counts.new })} />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <InboxTabs current="/feedback" />
        <DataList
          caption={t("caption")}
          columns={columns}
          rows={items}
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
            all > 0 ? (
              <PageState kind="empty" icon={<SmileIcon />} title={t("noMatchTitle")} description={t("noMatchBody")} />
            ) : (
              <PageState kind="empty" icon={<SmileIcon />} title={t("emptyTitle")} description={t("emptyBody")} />
            )
          }
          pagination={
            pages.hasPrevious || pages.hasNext
              ? {
                  previousLabel: t("previous"),
                  nextLabel: t("next"),
                  previous: pages.hasPrevious ? { href: listHref(status, pages.page - 1) } : undefined,
                  next: pages.hasNext ? { href: listHref(status, pages.page + 1) } : undefined,
                }
              : undefined
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
      </div>
    </>
  )
}
