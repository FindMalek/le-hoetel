import type { AppRouterClient } from "@ritorno/orpc/client"
import { Num } from "@ritorno/ui/components/num"
import { PageState } from "@ritorno/ui/components/page-state"
import { formatNumber } from "@ritorno/ui/lib/number"
import { BuildingIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { HotelAvatar } from "@/components/hotel-avatar"
import { consentRate } from "@/lib/admin"

type Hotel = Awaited<ReturnType<AppRouterClient["admin"]["hotels"]["list"]>>[number]

export async function AdminPilotSuccess({ hotels }: { hotels: Hotel[] }) {
  const [t, locale] = await Promise.all([getTranslations("adminOverview.success"), getLocale()])

  if (hotels.length === 0)
    return <PageState kind="empty" icon={<BuildingIcon />} title={t("none")} description={t("noneHint")} />

  return (
    <ul className="flex flex-col divide-y rounded-card border">
      {[...hotels]
        .sort((a, b) => b.guestCount - a.guestCount)
        .map((hotel) => {
          const rate = consentRate(hotel)
          return (
            <li key={hotel.id}>
              <Link
                href={`/admin/hotels/${hotel.id}`}
                className="flex min-h-11 flex-col gap-3 p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring md:flex-row md:items-center md:justify-between"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <HotelAvatar name={hotel.displayName} logoKey={hotel.logoKey} />
                  <span className="min-w-0 flex-1 truncate font-medium">{hotel.displayName}</span>
                  <ChevronRightIcon
                    className="size-4 shrink-0 text-muted-foreground md:hidden rtl:rotate-180"
                    aria-hidden
                  />
                </span>
                <dl className="grid grid-cols-3 gap-3 text-small md:w-md md:shrink-0">
                  <div>
                    <dt className="text-caption text-muted-foreground">{t("guests")}</dt>
                    <dd className="font-medium tabular-nums">
                      <Num value={formatNumber(hotel.guestCount, locale)} />
                      <span className="block font-normal text-caption text-muted-foreground">
                        {t("newGuests", { count: hotel.guestsLast7Days })}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">{t("consent")}</dt>
                    <dd className="font-medium tabular-nums">{rate === null ? "–" : <Num value={`${rate}%`} />}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-muted-foreground">{t("activeDays")}</dt>
                    <dd className="font-medium tabular-nums">
                      <Num value={`${hotel.activeDays} / 7`} />
                    </dd>
                  </div>
                </dl>
              </Link>
            </li>
          )
        })}
    </ul>
  )
}
