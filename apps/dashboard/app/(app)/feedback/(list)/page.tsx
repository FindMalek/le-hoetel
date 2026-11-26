import { FEEDBACK_CASE_STATUSES } from "@ritorno/common/feedback-case"
import { PageState } from "@ritorno/ui/components/page-state"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { SmileIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { FeedbackCasesList } from "@/components/feedback-cases-list"
import { InboxTabs } from "@/components/inbox-tabs"
import { PageHeader } from "@/components/page-header"
import { call, currentHotel, getQueryClient, serverOrpc } from "@/lib/api"
import { feedbackCasesList } from "@/lib/lists"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav")
  return { title: t("unhappyGuests") }
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const raw = await searchParams
  const status = FEEDBACK_CASE_STATUSES.find((value) => value === first(raw.status))
  const [t, tInbox, { activeId }, hotel] = await Promise.all([
    getTranslations("feedbackCases"),
    getTranslations("inbox"),
    call((api) => api.hotel.mine()),
    currentHotel(),
  ])
  const hotelId = hotel?.id ?? activeId
  if (!hotelId) {
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

  const queryClient = getQueryClient()
  const data = await call(() => queryClient.fetchInfiniteQuery(feedbackCasesList(serverOrpc, hotelId, { status })))

  return (
    <>
      <PageHeader title={tInbox("title")} description={t("waiting", { count: data.pages[0]?.counts.new ?? 0 })} />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <InboxTabs current="/feedback" />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <FeedbackCasesList hotelId={hotelId} status={status} timeZone={hotel?.timezone} />
        </HydrationBoundary>
      </div>
    </>
  )
}
