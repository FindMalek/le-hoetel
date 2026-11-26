import { formatTnd } from "@ritorno/common/pricing"
import type { AppRouterClient } from "@ritorno/orpc/client"
import { PageState } from "@ritorno/ui/components/page-state"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { HotelAvatar } from "@/components/hotel-avatar"
import { daysUntil, HEALTH_TONE, PILOT_ENDING_DAYS } from "@/lib/admin"

type Hotel = Awaited<ReturnType<AppRouterClient["admin"]["hotels"]["list"]>>[number]
type LowBalance = Awaited<ReturnType<AppRouterClient["admin"]["hotels"]["overview"]>>["lowBalance"][number]

/** Hotels a super admin should follow up on: unhealthy, pilot ending within two weeks, or WhatsApp credit running low. */
export async function AdminAttention({
  hotels,
  lowBalance,
  now,
}: {
  hotels: Hotel[]
  lowBalance: LowBalance[]
  now: Date
}) {
  const [t, tHealth, locale] = await Promise.all([
    getTranslations("adminOverview.attention"),
    getTranslations("adminHotels.health"),
    getLocale(),
  ])
  const low = new Map(lowBalance.map((row) => [row.id, row.balanceMillimes]))
  const rows = hotels.flatMap((hotel) => {
    const days = hotel.status === "pilot" && hotel.pilotEndsAt ? daysUntil(hotel.pilotEndsAt, now) : null
    const reasons = [
      hotel.health !== "healthy" ? (
        <StatusBadge key="health" tone={HEALTH_TONE[hotel.health]}>
          {tHealth(hotel.health)}
        </StatusBadge>
      ) : null,
      days !== null && days <= PILOT_ENDING_DAYS ? (
        <StatusBadge key="pilot" tone="warning">
          {days < 0 ? t("pilotEnded") : t("pilotEnds", { days })}
        </StatusBadge>
      ) : null,
      low.has(hotel.id) ? (
        <StatusBadge key="balance" tone="danger">
          {t("lowBalance", { amount: formatTnd(low.get(hotel.id) ?? 0, locale) })}
        </StatusBadge>
      ) : null,
    ].filter(Boolean)
    return reasons.length ? [{ hotel, reasons }] : []
  })

  if (rows.length === 0)
    return <PageState kind="empty" icon={<CheckCircle2Icon />} title={t("none")} description={t("noneHint")} />

  return (
    <ul className="flex flex-col divide-y rounded-card border">
      {rows.map(({ hotel, reasons }) => (
        <li key={hotel.id}>
          <Link
            href={`/admin/hotels/${hotel.id}`}
            className="flex min-h-11 items-center gap-3 p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HotelAvatar name={hotel.displayName} logoKey={hotel.logoKey} />
            <span className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="truncate font-medium">{hotel.displayName}</span>
              <span className="flex flex-wrap gap-2">{reasons}</span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}
