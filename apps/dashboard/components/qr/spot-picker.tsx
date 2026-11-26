"use client"

import { parseSpots, QR_SPOTS_MAX, spotsBetween, staffLabel } from "@ritorno/common/qr"
import type { Spot, SpotSource } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Checkbox } from "@ritorno/ui/components/checkbox"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { FormField } from "@ritorno/ui/components/form-field"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { Textarea } from "@ritorno/ui/components/textarea"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

export type Selection = { mode: "all" | "range" | "pick"; from: string; to: string; picked: ReadonlySet<string> }

export const EVERY_SPOT: Selection = { mode: "all", from: "", to: "", picked: new Set() }

const keyOf = (spot: Spot) => `${spot.source}:${spot.name}`

/** The saved spots the selection keeps, in the saved order. */
export function chosenSpots(saved: Spot[], selection: Selection): Spot[] {
  if (selection.mode === "pick") return saved.filter((spot) => selection.picked.has(keyOf(spot)))
  if (selection.mode === "all") return saved
  const inRange = new Set(
    spotsBetween(
      saved.map((spot) => spot.name),
      selection.from,
      selection.to,
    ),
  )
  return saved.filter((spot) => inRange.has(spot.name))
}

// i18n-used: qrCodes.rooms
// i18n-used: qrCodes.tables
const GROUPS = { room: "rooms", table: "tables" } as const
// i18n-used: qrCodes.roomHint
// i18n-used: qrCodes.tableHint
const HINTS = { room: "roomHint", table: "tableHint" } as const

function AddSpots({ sources, open }: { sources: readonly SpotSource[]; open: boolean }) {
  const t = useTranslations("qrCodes")
  const queryClient = useQueryClient()
  const [text, setText] = useState("")
  const [picked, setPicked] = useState<SpotSource | null>(null)
  const source = picked && sources.includes(picked) ? picked : sources[0]!
  const typed = parseSpots(text)
  const add = useMutation(
    orpc.hotel.spots.add.mutationOptions({
      onSuccess: (spots) => {
        queryClient.setQueryData(orpc.hotel.spots.list.queryKey(), spots)
        setText("")
        toast.success(t("added"))
      },
      onError: (error: Error) => toast.error(errorMessage(error)),
    }),
  )
  return (
    <details open={open} className="group rounded-card border">
      <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-3 px-4 font-medium text-sm [&::-webkit-details-marker]:hidden">
        {t("addTitle")}
        <ChevronDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" />
      </summary>
      <form
        className="flex flex-col gap-3 border-t p-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (typed.spots.length) add.mutate({ source, names: typed.spots })
        }}
      >
        {sources.length > 1 ? (
          <SegmentedControl
            label={t("addKind")}
            block
            value={source}
            onValueChange={setPicked}
            options={sources.map((item) => ({ value: item, label: t(GROUPS[item]) }))}
          />
        ) : null}
        <FormField id="new-spots" label={t(GROUPS[source])} hint={t("spotsHint")}>
          {(aria) => (
            <Textarea
              {...aria}
              rows={2}
              dir="auto"
              enterKeyHint="done"
              placeholder={t(HINTS[source])}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          )}
        </FormField>
        {typed.cut ? <InlineAlert tone="warning" title={t("spotsCut", { max: QR_SPOTS_MAX })} /> : null}
        <Button type="submit" variant="outline" loading={add.isPending} disabled={!typed.spots.length}>
          <PlusIcon data-icon="inline-start" />
          {t("addSpots", { count: typed.spots.length })}
        </Button>
      </form>
    </details>
  )
}

/** One selector for every piece, over the saved rooms and tables. */
export function SpotPicker({
  sources,
  saved,
  selection,
  onChange,
}: {
  sources: readonly SpotSource[]
  /** The saved spots of `sources`. */
  saved: Spot[]
  selection: Selection
  onChange: (selection: Selection) => void
}) {
  const t = useTranslations("qrCodes")
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const ticked = saved.filter((spot) => selection.picked.has(keyOf(spot)))
  const count = chosenSpots(saved, selection).length
  const remove = useMutation(
    orpc.hotel.spots.remove.mutationOptions({
      onSuccess: (left) => {
        queryClient.setQueryData(orpc.hotel.spots.list.queryKey(), left)
        onChange({ ...selection, picked: new Set() })
        setConfirming(false)
      },
      onError: (error: Error) => toast.error(errorMessage(error)),
    }),
  )
  const tick = (spots: Spot[], on: boolean) => {
    const next = new Set(selection.picked)
    for (const spot of spots) {
      if (on) next.add(keyOf(spot))
      else next.delete(keyOf(spot))
    }
    onChange({ ...selection, picked: next })
  }

  if (!saved.length) {
    return (
      <>
        <p className="text-muted-foreground text-sm">{t("noneSaved")}</p>
        <AddSpots sources={sources} open />
      </>
    )
  }

  return (
    <>
      <SegmentedControl
        label={t("selectionLabel")}
        block
        value={selection.mode}
        onValueChange={(mode) => onChange({ ...selection, mode })}
        options={[
          { value: "all", label: t("modeAll") },
          { value: "range", label: t("modeRange") },
          { value: "pick", label: t("modePick") },
        ]}
      />
      {selection.mode === "range" ? (
        <div className="grid grid-cols-2 gap-3">
          {(["from", "to"] as const).map((end) => (
            <FormField key={end} id={`range-${end}`} label={end === "from" ? t("rangeFrom") : t("rangeTo")}>
              {(aria) => (
                <Input
                  {...aria}
                  dir="auto"
                  value={selection[end]}
                  placeholder={end === "from" ? saved[0]!.name : saved.at(-1)!.name}
                  onChange={(event) => onChange({ ...selection, [end]: event.target.value })}
                />
              )}
            </FormField>
          ))}
        </div>
      ) : null}
      {selection.mode === "pick" ? (
        <div className="flex flex-col gap-2">
          <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-card border p-3">
            {sources.map((source) => {
              const group = saved.filter((spot) => spot.source === source)
              if (!group.length) return null
              return (
                <fieldset key={source}>
                  <legend className="mb-2 font-medium text-sm">{t(GROUPS[source])}</legend>
                  <div className="flex flex-wrap gap-2">
                    {group.map((spot) => (
                      // biome-ignore lint/a11y/noLabelWithoutControl: the checkbox inside is the control
                      <label
                        key={spot.name}
                        className="flex min-h-touch min-w-0 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm tabular-nums has-data-checked:border-primary has-data-checked:bg-surface"
                      >
                        <Checkbox
                          checked={selection.picked.has(keyOf(spot))}
                          onCheckedChange={(on) => tick([spot], on === true)}
                        />
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
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" className="min-h-touch" onClick={() => tick(saved, ticked.length !== saved.length)}>
              {ticked.length === saved.length ? t("clearSelection") : t("selectAll")}
            </Button>
            {ticked.length ? (
              <Button variant="ghost" className="min-h-touch" onClick={() => setConfirming(true)}>
                <Trash2Icon data-icon="inline-start" />
                {t("removeSelected")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground text-sm tabular-nums">
        {t("selected", { count, total: saved.length })}
      </p>
      <AddSpots sources={sources} open={false} />
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("removeTitle", { count: ticked.length })}
        description={t("removeBody")}
        confirmLabel={t("removeConfirm")}
        cancelLabel={t("removeCancel")}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate({ spots: ticked })}
      />
    </>
  )
}
