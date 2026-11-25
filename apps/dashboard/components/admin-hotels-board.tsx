"use client"

import { HOTEL_HEALTHS, HOTEL_STATUSES, type HotelHealth, type HotelStatus } from "@ritorno/common/hotel"
import type { AppRouterClient } from "@ritorno/orpc/client"
import { Badge } from "@ritorno/ui/components/badge"
import { Button } from "@ritorno/ui/components/button"
import { type DataColumn, DataTable } from "@ritorno/ui/components/data-table"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { Input } from "@ritorno/ui/components/input"
import { Label } from "@ritorno/ui/components/label"
import { BuildingIcon, ChevronRightIcon, PlusIcon, SearchXIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { selectClass } from "@/components/admin-fields"
import { HotelAvatar } from "@/components/hotel-avatar"
import { relativeTime } from "@/components/relative-day"
import { consentRate, daysUntil, HEALTH_TONE } from "@/lib/admin"

type Hotel = Awaited<ReturnType<AppRouterClient["admin"]["hotels"]["list"]>>[number]

export function AdminHotelsBoard({ hotels, now }: { hotels: Hotel[]; now: Date }) {
  const t = useTranslations("adminHotels")
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<HotelStatus | "">("")
  const [health, setHealth] = useState<HotelHealth | "">("")

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return hotels.filter(
      (hotel) =>
        (!needle || `${hotel.displayName} ${hotel.name} ${hotel.slug}`.toLowerCase().includes(needle)) &&
        (!status || hotel.status === status) &&
        (!health || hotel.health === health),
    )
  }, [hotels, query, status, health])
  const filtered = Boolean(query || status || health)
  const reset = () => {
    setQuery("")
    setStatus("")
    setHealth("")
  }

  const rate = (hotel: Hotel) => {
    const value = consentRate(hotel)
    return value === null ? "–" : `${value}%`
  }
  const last = (hotel: Hotel) => (hotel.lastGuestAt ? relativeTime(hotel.lastGuestAt, now, locale) : t("noCapture"))
  const pilot = (hotel: Hotel) => {
    if (!hotel.pilotEndsAt) return t("noPilotEnd")
    const days = daysUntil(hotel.pilotEndsAt, now)
    return days < 0 ? t("pilotEnded") : t("pilotLeft", { days })
  }
  const healthBadge = (hotel: Hotel) => <Badge variant={HEALTH_TONE[hotel.health]}>{t(`health.${hotel.health}`)}</Badge>
  const name = (hotel: Hotel) => (
    <Link
      href={`/admin/hotels/${hotel.id}`}
      className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <HotelAvatar name={hotel.displayName} logoKey={hotel.logoKey} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{hotel.displayName}</span>
        <span className="truncate text-muted-foreground text-xs" dir="ltr">
          {hotel.slug}
        </span>
      </span>
    </Link>
  )

  const columns: DataColumn<Hotel>[] = [
    { id: "hotel", header: t("columns.hotel"), cell: name },
    { id: "health", header: t("columns.health"), cell: healthBadge },
    { id: "guests", header: t("columns.guests"), cell: (hotel) => hotel.guestCount, align: "end" },
    { id: "consent", header: t("columns.consent"), cell: rate, align: "end", showFrom: "lg" },
    { id: "last", header: t("columns.lastCapture"), cell: last, align: "end", showFrom: "lg" },
    { id: "pilot", header: t("columns.pilotEnd"), cell: pilot, align: "end", showFrom: "xl" },
    {
      id: "plan",
      header: t("columns.plan"),
      cell: (hotel) => (
        <span className="flex items-center justify-end gap-2">
          <Badge variant="outline">{t(`plan.${hotel.plan}`)}</Badge>
          <ChevronRightIcon className="size-4 text-muted-foreground rtl:rotate-180" aria-hidden />
        </span>
      ),
      align: "end",
    },
  ]

  if (hotels.length === 0)
    return (
      <EmptyState
        decorated
        icon={<BuildingIcon />}
        title={t("empty.title")}
        description={t("empty.description")}
        action={
          <Button render={<Link href="/admin/hotels/new" />} nativeButton={false}>
            <PlusIcon data-icon="inline-start" />
            {t("new")}
          </Button>
        }
      />
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto]">
        <div className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="hotel-search">{t("search")}</Label>
          <Input
            id="hotel-search"
            type="search"
            value={query}
            enterKeyHint="search"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hotel-status">{t("filters.status")}</Label>
          <select
            id="hotel-status"
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as HotelStatus | "")}
          >
            <option value="">{t("filters.any")}</option>
            {HOTEL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="hotel-health">{t("filters.health")}</Label>
          <select
            id="hotel-health"
            className={selectClass}
            value={health}
            onChange={(event) => setHealth(event.target.value as HotelHealth | "")}
          >
            <option value="">{t("filters.any")}</option>
            {HOTEL_HEALTHS.map((value) => (
              <option key={value} value={value}>
                {t(`health.${value}`)}
              </option>
            ))}
          </select>
        </div>
        {filtered && (
          <div className="flex items-end">
            <Button variant="outline" className="max-sm:w-full" onClick={reset}>
              {t("reset")}
            </Button>
          </div>
        )}
      </div>
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {t("count", { count: rows.length })}
      </p>
      <DataTable
        caption={t("title")}
        rows={rows}
        columns={columns}
        getRowKey={(hotel) => hotel.id}
        empty={
          <EmptyState
            icon={<SearchXIcon />}
            title={t("noMatch.title")}
            description={t("noMatch.description")}
            action={
              <Button variant="outline" onClick={reset}>
                {t("reset")}
              </Button>
            }
          />
        }
        card={(hotel) => (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              {name(hotel)}
              <ChevronRightIcon className="mt-3 size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {healthBadge(hotel)}
              <Badge variant="outline">{t(`plan.${hotel.plan}`)}</Badge>
              <Badge variant="outline">{t(`status.${hotel.status}`)}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {(
                [
                  ["guests", String(hotel.guestCount)],
                  ["consent", rate(hotel)],
                  ["lastCapture", last(hotel)],
                  ["pilotEnd", pilot(hotel)],
                ] as const
              ).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-muted-foreground text-xs">{t(`columns.${key}`)}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      />
    </div>
  )
}
