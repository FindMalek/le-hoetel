"use client"

import { HOLIDAY_CHANNELS, HOLIDAYS, type HolidayChannel } from "@ritorno/common/holidays"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Switch } from "@ritorno/ui/components/switch"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 md:h-9 md:w-44 md:text-sm"

export function HolidaysBoard() {
  const t = useTranslations("holidays")
  const locale = useLocale() as "en" | "fr" | "ar"
  const queryClient = useQueryClient()
  const { data: holidays } = useSuspenseQuery(orpc.holidays.list.queryOptions())
  const update = useMutation(
    orpc.holidays.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("saved"))
        return queryClient.invalidateQueries({ queryKey: orpc.holidays.key() })
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const pending = update.isPending

  return (
    <ul className="divide-y rounded-xl border">
      {holidays.map((holiday) => {
        const { name } = HOLIDAYS[holiday.key].text[locale]
        const date = holiday.next
          ? new Date(`${holiday.next}T12:00:00Z`).toLocaleDateString(locale, { dateStyle: "long", timeZone: "UTC" })
          : null
        const change = (patch: { enabled?: boolean; channel?: HolidayChannel }) =>
          update.mutate({ key: holiday.key, enabled: holiday.enabled, channel: holiday.channel, ...patch })
        return (
          <li key={holiday.key} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{name}</span>
              <span className="text-muted-foreground text-sm">{date ? t("next", { date }) : t("noDate")}</span>
            </div>
            <div className="flex items-center justify-between gap-3 md:justify-end">
              <select
                aria-label={t("channelFor", { name })}
                className={SELECT_CLASS}
                value={holiday.channel}
                disabled={!holiday.enabled || pending}
                onChange={(event) => change({ channel: event.target.value as HolidayChannel })}
              >
                {HOLIDAY_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {t(`channel.${channel}`)}
                  </option>
                ))}
              </select>
              <Switch
                aria-label={t("switchFor", { name })}
                checked={holiday.enabled}
                disabled={pending}
                onCheckedChange={(enabled) => change({ enabled })}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
