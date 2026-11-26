"use client"

import { HOLIDAY_CHANNELS, HOLIDAYS, type HolidayChannel } from "@ritorno/common/holidays"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Num } from "@ritorno/ui/components/num"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { Select } from "@ritorno/ui/components/select"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { Switch } from "@ritorno/ui/components/switch"
import { cn } from "@ritorno/ui/lib/utils"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { CalendarDaysIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

const DAY = 86_400_000

const daysUntil = (next: string, now: Date): number => {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.parse(`${next}T00:00:00Z`) - today) / DAY)
}

export function HolidaysBoard({ hotelName, defaultLanguage }: { hotelName: string; defaultLanguage: HotelLanguage }) {
  const t = useTranslations("holidays")
  const locale = useLocale() as HotelLanguage
  const queryClient = useQueryClient()
  const [previewIn, setPreviewIn] = useState<HotelLanguage>(defaultLanguage)
  const { data: holidays } = useSuspenseQuery(orpc.holidays.list.queryOptions())
  const update = useMutation(
    orpc.holidays.update.mutationOptions({
      onSuccess: (_, input) => {
        toast.success(input.enabled ? t("savedOn") : t("savedOff"))
        return queryClient.invalidateQueries({ queryKey: orpc.holidays.key() })
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const now = new Date()
  const sorted = [...holidays].sort((a, b) => (a.next ?? "9999").localeCompare(b.next ?? "9999"))
  const enabled = holidays.filter((holiday) => holiday.enabled).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-muted-foreground text-sm">
          {t.rich("summary", {
            count: enabled,
            on: () => <Num value={enabled} locale={locale} className="font-semibold text-foreground" />,
            total: () => <Num value={holidays.length} locale={locale} />,
          })}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-sm">{t("previewIn")}</span>
          <SegmentedControl
            label={t("previewIn")}
            value={previewIn}
            onValueChange={setPreviewIn}
            options={HOTEL_LANGUAGES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
          />
        </div>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {sorted.map((holiday) => {
          const { name } = HOLIDAYS[holiday.key].text[locale]
          const greeting = HOLIDAYS[holiday.key].text[previewIn]
          const date = holiday.next
            ? new Date(`${holiday.next}T12:00:00Z`).toLocaleDateString(locale, { dateStyle: "long", timeZone: "UTC" })
            : null
          const days = holiday.next ? daysUntil(holiday.next, now) : null
          const pending = update.isPending && update.variables?.key === holiday.key
          const change = (patch: { enabled?: boolean; channel?: HolidayChannel }) =>
            update.mutate({ key: holiday.key, enabled: holiday.enabled, channel: holiday.channel, ...patch })
          return (
            <li
              key={holiday.key}
              className={cn(
                "flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-colors duration-200",
                holiday.enabled && "border-foreground/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="font-semibold text-h3">{name}</h3>
                  <p className="flex flex-wrap items-center gap-x-2 text-muted-foreground text-sm">
                    <CalendarDaysIcon aria-hidden className="size-4" />
                    <span suppressHydrationWarning>{date ?? t("noDate")}</span>
                    {days !== null ? (
                      <span suppressHydrationWarning>
                        {t.rich("inDays", { count: days, n: () => <Num value={days} locale={locale} /> })}
                      </span>
                    ) : null}
                  </p>
                </div>
                <Switch
                  aria-label={t("switchFor", { name })}
                  checked={holiday.enabled}
                  disabled={pending}
                  onCheckedChange={(next) => change({ enabled: next })}
                />
              </div>
              <blockquote
                lang={previewIn}
                dir={previewIn === "ar" ? "rtl" : "ltr"}
                className="flex flex-col gap-1 rounded-xl bg-surface p-4 text-sm"
              >
                <span className="font-medium">{greeting.name}</span>
                <span className="text-muted-foreground">{greeting.body.replaceAll("{hotel}", hotelName)}</span>
              </blockquote>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                <StatusBadge tone={holiday.enabled ? "success" : "neutral"}>
                  {holiday.enabled ? t("on") : t("off")}
                </StatusBadge>
                <Select
                  aria-label={t("channelFor", { name })}
                  className="w-full sm:w-52"
                  value={holiday.channel}
                  disabled={!holiday.enabled || pending}
                  onValueChange={(channel) => change({ channel })}
                  options={HOLIDAY_CHANNELS.map((channel) => ({ value: channel, label: t(`channel.${channel}`) }))}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
