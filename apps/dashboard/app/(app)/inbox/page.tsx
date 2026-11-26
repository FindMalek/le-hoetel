import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { InboxList } from "@/components/inbox-list"
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
      <div className="p-4 md:p-6">
        <InboxList items={items} unread={unread} timeZone={hotel?.timezone} />
      </div>
    </>
  )
}
