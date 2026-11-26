"use client"

import { staffLabel } from "@ritorno/common/qr"
import { SPOT_SOURCES, type Spot } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Checkbox } from "@ritorno/ui/components/checkbox"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { Section } from "@ritorno/ui/components/section"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { PrinterIcon, QrCodeIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

// i18n-used: qrCodes.rooms
// i18n-used: qrCodes.tables
const GROUPS = { room: "rooms", table: "tables" } as const
const keyOf = (spot: Spot) => `${spot.source}:${spot.name}`

/** The cut sheet of `spots`; none picked means all of them, which keeps the url short. */
function sheetHref(spots: Spot[]) {
  const query = new URLSearchParams()
  for (const source of SPOT_SOURCES) {
    const names = spots.filter((spot) => spot.source === source).map((spot) => spot.name)
    if (names.length) query.set(source, names.join(","))
  }
  return `/print/qr-sheet?${query}` as const
}

export function QrSpots() {
  const t = useTranslations("qrCodes")
  const queryClient = useQueryClient()
  const { data: spots } = useSuspenseQuery(orpc.hotel.spots.list.queryOptions())
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const chosen = spots.filter((spot) => picked.has(keyOf(spot)))
  const remove = useMutation(
    orpc.hotel.spots.remove.mutationOptions({
      onSuccess: (left) => {
        queryClient.setQueryData(orpc.hotel.spots.list.queryKey(), left)
        setPicked(new Set())
      },
      onError: (error: Error) => toast.error(errorMessage(error)),
    }),
  )
  const toggle = (key: string, on: boolean) => {
    const next = new Set(picked)
    if (on) next.add(key)
    else next.delete(key)
    setPicked(next)
  }

  return (
    <Section title={t("savedTitle")} description={t("savedDescription")}>
      {spots.length ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-touch"
              render={
                <Link href={sheetHref(chosen.length === spots.length ? [] : chosen)} target="_blank" prefetch={false} />
              }
              nativeButton={false}
            >
              <PrinterIcon data-icon="inline-start" />
              {chosen.length ? t("printSelected", { count: chosen.length }) : t("printAll", { count: spots.length })}
            </Button>
            <Button
              variant="outline"
              className="min-h-touch"
              onClick={() => setPicked(new Set(chosen.length === spots.length ? [] : spots.map(keyOf)))}
            >
              {chosen.length === spots.length ? t("clearSelection") : t("selectAll")}
            </Button>
            {chosen.length ? (
              <Button
                variant="ghost"
                className="min-h-touch"
                loading={remove.isPending}
                onClick={() => remove.mutate({ spots: chosen })}
              >
                <Trash2Icon data-icon="inline-start" />
                {t("removeSelected")}
              </Button>
            ) : null}
          </div>
          <div className="flex max-h-96 flex-col gap-4 overflow-y-auto rounded-lg border bg-card p-4">
            {SPOT_SOURCES.map((source) => {
              const group = spots.filter((spot) => spot.source === source)
              if (!group.length) return null
              return (
                <fieldset key={source} className="flex flex-col gap-2">
                  <legend className="mb-2 font-medium text-sm">{t(GROUPS[source])}</legend>
                  <div className="flex flex-wrap gap-2">
                    {group.map((spot) => (
                      // biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control
                      <label
                        key={spot.name}
                        className="flex min-h-touch min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm tabular-nums"
                      >
                        <Checkbox checked={picked.has(keyOf(spot))} onCheckedChange={(on) => toggle(keyOf(spot), on)} />
                        <span className="break-all">
                          <bdi>{staffLabel(source, spot.name)}</bdi>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            })}
          </div>
        </>
      ) : (
        <EmptyState icon={<QrCodeIcon />} title={t("savedEmptyTitle")} description={t("savedEmpty")} />
      )}
    </Section>
  )
}
