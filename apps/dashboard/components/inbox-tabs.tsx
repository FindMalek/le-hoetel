import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

/** The two halves of the Inbox: notes for you, and the hotel's unhappy guests. */
export async function InboxTabs({ current }: { current: "/inbox" | "/feedback" }) {
  const [t, tNav] = await Promise.all([getTranslations("inbox"), getTranslations("nav")])
  return (
    <SegmentedControl
      label={t("title")}
      className="w-fit max-w-full"
      linkComponent={Link}
      value={current}
      options={[
        { value: "/inbox", href: "/inbox", label: t("notifications") },
        { value: "/feedback", href: "/feedback", label: tNav("unhappyGuests") },
      ]}
    />
  )
}
