import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

/** The parts of the Inbox: notes for you, the hotel's unhappy guests, and guests who wrote on WhatsApp. */
export async function InboxTabs({ current }: { current: "/inbox" | "/feedback" | "/whatsapp" }) {
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
        { value: "/whatsapp", href: "/whatsapp", label: tNav("whatsappScans") },
      ]}
    />
  )
}
