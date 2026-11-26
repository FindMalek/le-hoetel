import { Button } from "@ritorno/ui/components/button"
import { Num } from "@ritorno/ui/components/num"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { formatNumber } from "@ritorno/ui/lib/number"
import { CheckCircle2Icon, ChevronRightIcon, InboxIcon, PhoneIcon } from "lucide-react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

type Alert = {
  id: string
  guestId: string
  name: string
  phoneE164: string
  nps: number
  comment: string | null
  createdAt: Date
}

type HomeAttentionProps = {
  alerts: { open: number; items: Alert[] }
  unread: number
  /** The hotel's timezone, so a date never shifts by a day near midnight. */
  timeZone: string
}

const ROW = "flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4 md:px-5"

/** What needs a person today: unhappy guests to call first, then unread notifications. A calm line when nothing does. */
export async function HomeAttention({ alerts, unread, timeZone }: HomeAttentionProps) {
  const [t, locale] = await Promise.all([getTranslations("home.attention"), getLocale()])
  const n = (chunks: ReactNode) => <bdi dir="ltr">{chunks}</bdi>
  const more = alerts.open - alerts.items.length

  if (!alerts.open && !unread) {
    return (
      <div className="flex items-center gap-3 rounded-card border bg-card p-4 md:px-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2Icon className="size-4.5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="font-medium text-small">{t("clearTitle")}</p>
          <p className="text-caption text-muted-foreground">{t("clearBody")}</p>
        </div>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y rounded-card border bg-card">
      {alerts.items.map((alert) => (
        <li key={alert.id} className={ROW}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <StatusBadge tone="danger" className="mt-0.5">
              <Num value={`${alert.nps}/10`} />
            </StatusBadge>
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link
                href={`/guests/${alert.guestId}`}
                className="w-fit font-medium text-small underline-offset-4 hover:underline"
              >
                {alert.name}
              </Link>
              <p className="line-clamp-2 text-muted-foreground text-small">{alert.comment ?? t("noComment")}</p>
              <p className="text-caption text-muted-foreground">
                {t("answered")} {formatDate(alert.createdAt, locale, timeZone)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="max-md:w-full"
            render={<a href={`tel:${alert.phoneE164}`} aria-label={t("callGuest", { name: alert.name })} />}
            nativeButton={false}
          >
            <PhoneIcon data-icon="inline-start" />
            {t("call")}
          </Button>
        </li>
      ))}
      {more > 0 ? (
        <li className="px-4 py-3 text-caption text-muted-foreground md:px-5">
          {t.rich("more", { count: more, shown: formatNumber(more, locale), n })}
        </li>
      ) : null}
      {unread > 0 ? (
        <li>
          <Link
            href="/inbox"
            className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface">
              <InboxIcon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 font-medium text-small">
              {t.rich("unread", { count: unread, shown: formatNumber(unread, locale), n })}
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
          </Link>
        </li>
      ) : null}
    </ul>
  )
}
