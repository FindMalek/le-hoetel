import { BellIcon } from "lucide-react"
import Link from "next/link"

/** Floats top right on every app page, with the unread count. */
export function InboxBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/inbox"
      aria-label={unread ? `${unread} unread notifications` : "Notifications"}
      className="fixed end-4 top-3 z-40 inline-flex size-11 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:text-foreground"
    >
      <BellIcon className="size-4" />
      {unread > 0 && (
        <span className="-top-1.5 -end-1.5 absolute grid min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  )
}
