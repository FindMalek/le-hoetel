"use client"

import { HOLIDAY_CHANNELS, HOLIDAYS, type HolidayChannel } from "@ritorno/common/holidays"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Select } from "@ritorno/ui/components/select"
import { Switch } from "@ritorno/ui/components/switch"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

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
              <Select
                aria-label={t("channelFor", { name })}
                size="sm"
                className="md:w-44"
                value={holiday.channel}
                disabled={!holiday.enabled || pending}
                onValueChange={(channel) => change({ channel })}
                options={HOLIDAY_CHANNELS.map((channel) => ({ value: channel, label: t(`channel.${channel}`) }))}
              />
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
