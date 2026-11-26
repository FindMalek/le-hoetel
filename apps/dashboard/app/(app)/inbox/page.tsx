import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { InboxList } from "@/components/inbox-list"
import { InboxTabs } from "@/components/inbox-tabs"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Inbox" }

export default async function InboxPage() {
  const [t, { items, unread }, hotel] = await Promise.all([
    getTranslations("inbox"),
    call((api) => api.inbox.list()),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  return (
    <>
      <PageHeader title={t("title")} description={unread ? t("unread", { count: unread }) : t("caughtUp")} />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <InboxTabs current="/inbox" />
        <InboxList items={items} unread={unread} timeZone={hotel?.timezone} />
      </div>
    </>
  )
}
