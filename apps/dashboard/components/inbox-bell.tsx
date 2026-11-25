import { BellIcon } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"

export async function InboxBell({ unread }: { unread: number }) {
  const t = await getTranslations("shell")
  return (
    <Link
      href="/inbox"
      aria-label={unread ? t("unread", { count: unread }) : t("notifications")}
      className="relative inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <BellIcon className="size-5" />
      {unread > 0 ? (
        <span
          aria-hidden
          className="absolute end-1 top-1 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-primary-foreground text-xs tabular-nums"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  )
}
