"use client"

import { HOTEL_HEALTHS, HOTEL_STATUSES, type HotelHealth, type HotelStatus } from "@ritorno/common/hotel"
import type { AppRouterClient } from "@ritorno/orpc/client"
import { Button } from "@ritorno/ui/components/button"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { Num } from "@ritorno/ui/components/num"
import { PageState } from "@ritorno/ui/components/page-state"
import { Select } from "@ritorno/ui/components/select"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { BuildingIcon, ChevronRightIcon, PlusIcon, SearchXIcon } from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { HotelAvatar } from "@/components/hotel-avatar"
import { relativeTime } from "@/components/relative-day"
import { daysUntil, HEALTH_TONE, PILOT_ENDING_DAYS, STATUS_TONE } from "@/lib/admin"

type Hotel = Awaited<ReturnType<AppRouterClient["admin"]["hotels"]["list"]>>[number]

const ALL = "all"

export function AdminHotelsBoard({ hotels, now }: { hotels: Hotel[]; now: Date }) {
  const t = useTranslations("adminHotels")
  const locale = useLocale()
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<HotelStatus | typeof ALL>(ALL)
  const [health, setHealth] = useState<HotelHealth | typeof ALL>(ALL)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return hotels.filter(
      (hotel) =>
        (!needle || `${hotel.displayName} ${hotel.name} ${hotel.slug}`.toLowerCase().includes(needle)) &&
        (status === ALL || hotel.status === status) &&
        (health === ALL || hotel.health === health),
    )
  }, [hotels, query, status, health])
  const filtered = Boolean(query) || status !== ALL || health !== ALL
  const reset = () => {
    setQuery("")
    setStatus(ALL)
    setHealth(ALL)
  }

  const last = (hotel: Hotel) => (hotel.lastGuestAt ? relativeTime(hotel.lastGuestAt, now, locale) : t("noCapture"))
  const pilot = (hotel: Hotel) => {
    if (!hotel.pilotEndsAt) return <span className="text-muted-foreground">{t("noPilotEnd")}</span>
    const days = daysUntil(hotel.pilotEndsAt, now)
    return (
      <span className="flex flex-col items-end">
        <span>{formatDate(hotel.pilotEndsAt, locale, hotel.timezone)}</span>
        <span
          className={days <= PILOT_ENDING_DAYS ? "text-warning text-caption" : "text-caption text-muted-foreground"}
        >
          {days < 0 ? t("pilotEnded") : t("pilotLeft", { days })}
        </span>
      </span>
    )
  }
  const statusBadge = (hotel: Hotel) => (
    <StatusBadge tone={STATUS_TONE[hotel.status]}>{t(`status.${hotel.status}`)}</StatusBadge>
  )
  const healthBadge = (hotel: Hotel) => (
    <StatusBadge tone={HEALTH_TONE[hotel.health]}>{t(`health.${hotel.health}`)}</StatusBadge>
  )
  const identity = (hotel: Hotel) => (
    <span className="flex min-w-0 items-center gap-3">
      <HotelAvatar name={hotel.displayName} logoKey={hotel.logoKey} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{hotel.displayName}</span>
        <span className="truncate text-caption text-muted-foreground" dir="ltr">
          {hotel.slug}
        </span>
      </span>
    </span>
  )

  const columns: DataColumn<Hotel>[] = [
    {
      id: "hotel",
      header: t("columns.hotel"),
      cell: (hotel) => (
        <Link
          href={`/admin/hotels/${hotel.id}`}
          className="flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {identity(hotel)}
        </Link>
      ),
    },
    { id: "status", header: t("columns.status"), cell: statusBadge },
    { id: "health", header: t("columns.health"), cell: healthBadge, showFrom: "lg" },
    {
      id: "guests",
      header: t("columns.guests"),
      cell: (hotel) => <Num value={hotel.guestCount} locale={locale} />,
      align: "end",
    },
    { id: "last", header: t("columns.lastCapture"), cell: last, align: "end", showFrom: "lg" },
    { id: "pilot", header: t("columns.pilotEnd"), cell: pilot, align: "end", showFrom: "xl" },
    {
      id: "open",
      header: <span className="sr-only">{t("open")}</span>,
      cell: () => <ChevronRightIcon className="ms-auto size-4 text-muted-foreground rtl:rotate-180" aria-hidden />,
      align: "end",
    },
  ]

  if (hotels.length === 0)
    return (
      <PageState
        kind="empty"
        firstRun
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
    <DataList
      caption={t("title")}
      rows={rows}
      columns={columns}
      getRowKey={(hotel) => hotel.id}
      filters={
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] lg:items-end">
          <FormField label={t("search")} className="sm:col-span-2 lg:col-span-1">
            {(aria) => (
              <Input
                {...aria}
                type="search"
                value={query}
                enterKeyHint="search"
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
          </FormField>
          <FormField label={t("filters.status")}>
            {(aria) => (
              <Select
                {...aria}
                value={status}
                onValueChange={setStatus}
                options={[
                  { value: ALL, label: t("filters.any") },
                  ...HOTEL_STATUSES.map((value) => ({ value, label: t(`status.${value}`) })),
                ]}
              />
            )}
          </FormField>
          <FormField label={t("filters.health")}>
            {(aria) => (
              <Select
                {...aria}
                value={health}
                onValueChange={setHealth}
                options={[
                  { value: ALL, label: t("filters.any") },
                  ...HOTEL_HEALTHS.map((value) => ({ value, label: t(`health.${value}`) })),
                ]}
              />
            )}
          </FormField>
          {filtered ? (
            <Button variant="outline" className="max-sm:w-full" onClick={reset}>
              {t("reset")}
            </Button>
          ) : null}
          <p className="text-muted-foreground text-small sm:col-span-2 lg:col-span-4" aria-live="polite">
            {t("count", { count: rows.length })}
          </p>
        </div>
      }
      empty={
        <PageState
          kind="empty"
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
        <Link href={`/admin/hotels/${hotel.id}`} className="-m-4 flex flex-col gap-3 p-4">
          <span className="flex items-center justify-between gap-3">
            {identity(hotel)}
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
          </span>
          <span className="flex flex-wrap items-center gap-2">
            {statusBadge(hotel)}
            {healthBadge(hotel)}
          </span>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-small">
            <div>
              <dt className="text-caption text-muted-foreground">{t("columns.guests")}</dt>
              <dd className="font-medium tabular-nums">
                <Num value={hotel.guestCount} locale={locale} />
              </dd>
            </div>
            <div>
              <dt className="text-caption text-muted-foreground">{t("columns.lastCapture")}</dt>
              <dd className="font-medium">{last(hotel)}</dd>
            </div>
            <div className="col-span-2 [&_span]:items-start">
              <dt className="text-caption text-muted-foreground">{t("columns.pilotEnd")}</dt>
              <dd className="font-medium">{pilot(hotel)}</dd>
            </div>
          </dl>
        </Link>
      )}
    />
  )
}
