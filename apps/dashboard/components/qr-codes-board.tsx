"use client"

import { parseSpots } from "@le-hoetel/common/qr"
import type { CaptureSource } from "@le-hoetel/common/schemas"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { type DataColumn, DataTable } from "@le-hoetel/ui/components/data-table"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { InlineAlert } from "@le-hoetel/ui/components/inline-alert"
import { Section } from "@le-hoetel/ui/components/section"
import { Skeleton } from "@le-hoetel/ui/components/skeleton"
import { StickyFormActions } from "@le-hoetel/ui/components/sticky-form-actions"
import { Tabs, TabsList, TabsTrigger } from "@le-hoetel/ui/components/tabs"
import { Textarea } from "@le-hoetel/ui/components/textarea"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { CheckIcon, CopyIcon, DownloadIcon, QrCodeIcon, RotateCwIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { FormField } from "./form-field"

const SOURCES = [
  { value: "room", label: "rooms", stored: "qr_room", hint: "roomHint", one: "room" },
  { value: "table", label: "tables", stored: "qr_table", hint: "tableHint", one: "table" },
  { value: "desk", label: "desk", stored: "qr_front_desk", hint: "deskHint", one: "desk" },
] as const
type Source = (typeof SOURCES)[number]

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
const fileName = (source: string, location: string | null, ext: string) =>
  `qr-${source}${location ? `-${location.replace(/[^\w-]+/g, "_")}` : ""}.${ext}`

function save(name: string, href: string) {
  const link = document.createElement("a")
  link.href = href
  link.download = name
  link.click()
}

async function savePng(name: string, svg: string) {
  const image = new Image()
  image.src = svgUrl(svg)
  await image.decode()
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 1024
  canvas.getContext("2d")?.drawImage(image, 0, 0, 1024, 1024)
  save(name, canvas.toDataURL("image/png"))
}

type Stat = { source: string; location: string | null; guests: number }

export function QrCodesBoard() {
  const t = useTranslations("qrCodes")
  const { data: stats } = useSuspenseQuery(orpc.hotel.captureStats.queryOptions())
  const [source, setSource] = useState<CaptureSource>("desk")
  const [spots, setSpots] = useState("")
  const [copied, setCopied] = useState<string | null>(null)
  const generate = useMutation(
    orpc.hotel.qrCodes.mutationOptions({ onError: (error: Error) => toast.error(errorMessage(error)) }),
  )
  const current: Source = SOURCES.find((item) => item.value === source) ?? SOURCES[2]
  const guestsAt = (location: string | null) =>
    stats.find((row) => row.source === current.stored && row.location === location)?.guests ?? 0

  const first = useRef(true)
  useEffect(() => {
    if (!first.current) return
    first.current = false
    generate.mutate({ source: "desk", spots: [] })
  }, [generate])

  const run = (event?: React.FormEvent) => {
    event?.preventDefault()
    generate.mutate({ source, spots: parseSpots(spots) })
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(url)
    toast.success(t("copied"))
    setTimeout(() => setCopied(null), 2000)
  }

  const labelOf = (stored: string) => {
    const found = SOURCES.find((item) => item.stored === stored)
    return found ? t(found.one) : stored
  }
  const columns: DataColumn<Stat>[] = [
    { id: "spot", header: t("colSpot"), cell: (row) => row.location ?? t("noSpot") },
    { id: "where", header: t("colWhere"), cell: (row) => labelOf(row.source) },
    { id: "guests", header: t("colGuests"), align: "end", cell: (row) => row.guests },
  ]

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <form onSubmit={run} className="flex flex-col gap-5 lg:sticky lg:top-20">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading font-semibold text-lg tracking-tight">{t("newTitle")}</h2>
          <p className="text-muted-foreground text-sm">{t("newDescription")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-medium text-sm">{t("where")}</span>
          <Tabs value={source} onValueChange={(next) => setSource(next as CaptureSource)}>
            <TabsList className="grid w-full grid-cols-3">
              {SOURCES.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {t(item.label)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <FormField id="spots" label={t("spots")} hint={t("spotsHint")} optional={source === "desk" ? ` (${t("optional")})` : undefined}>
          {(aria) => (
            <Textarea
              {...aria}
              rows={4}
              value={spots}
              onChange={(event) => setSpots(event.target.value)}
              placeholder={t(current.hint)}
              dir="auto"
              enterKeyHint="done"
            />
          )}
        </FormField>
        <StickyFormActions className="md:justify-start">
          <Button type="submit" loading={generate.isPending}>
            <QrCodeIcon data-icon="inline-start" />
            {t("generate")}
          </Button>
        </StickyFormActions>
      </form>

      <div className="flex min-w-0 flex-col gap-10">
        <Section title={t("resultsTitle")} description={t("resultsHint")}>
          {generate.isPending && !generate.data ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-busy="true">
              <span className="sr-only">{t("generating")}</span>
              <Skeleton className="aspect-[3/4] w-full" />
            </div>
          ) : generate.error ? (
            <InlineAlert
              tone="error"
              title={t("failed")}
              action={
                <Button size="sm" variant="outline" onClick={() => run()}>
                  <RotateCwIcon data-icon="inline-start" />
                  {t("retry")}
                </Button>
              }
            >
              {t("failedHint")}
            </InlineAlert>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {generate.data?.map((code) => {
                const name = code.location ?? t(current.one)
                return (
                  <li key={code.url} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
                    {/* biome-ignore lint/performance/noImgElement: a generated data url, nothing to optimize */}
                    <img
                      src={svgUrl(code.svg)}
                      alt={t("alt", { spot: name })}
                      className="aspect-square w-full rounded-md bg-white p-2"
                    />
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate font-medium">{name}</p>
                      <p className="text-muted-foreground text-sm tabular-nums">
                        {t("guestsSoFar", { count: guestsAt(code.location) })}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" size="sm" onClick={() => save(fileName(source, code.location, "svg"), svgUrl(code.svg))}>
                        <DownloadIcon data-icon="inline-start" /> SVG
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => savePng(fileName(source, code.location, "png"), code.svg)}>
                        <DownloadIcon data-icon="inline-start" /> PNG
                      </Button>
                      <Button variant="outline" size="sm" aria-label={t("copyLink")} onClick={() => copy(code.url)}>
                        {copied === code.url ? <CheckIcon /> : <CopyIcon />}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title={t("tableTitle")} description={t("tableDescription")}>
          <DataTable
            caption={t("tableTitle")}
            columns={columns}
            rows={stats}
            getRowKey={(row) => `${row.source}-${row.location}`}
            empty={<EmptyState icon={<QrCodeIcon />} title={t("emptyTitle")} description={t("empty")} />}
          />
        </Section>
      </div>
    </div>
  )
}
