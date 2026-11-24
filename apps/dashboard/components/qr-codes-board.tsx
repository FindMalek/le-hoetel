"use client"

import { parseSpots } from "@le-hoetel/common/qr"
import type { CaptureSource } from "@le-hoetel/common/schemas"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@le-hoetel/ui/components/field"
import { Textarea } from "@le-hoetel/ui/components/textarea"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

const LABEL_KEYS = [
  "newTitle",
  "newDescription",
  "where",
  "rooms",
  "tables",
  "desk",
  "room",
  "table",
  "roomHint",
  "tableHint",
  "deskHint",
  "spots",
  "spotsHint",
  "generate",
  "guestsSoFar",
  "alt",
  "tableTitle",
  "tableDescription",
  "empty",
  "colWhere",
  "colSpot",
  "colGuests",
] as const
export type QrCodesLabels = Record<(typeof LABEL_KEYS)[number], string>

const SOURCES: {
  value: CaptureSource
  label: "rooms" | "tables" | "desk"
  stored: string
  hint: "roomHint" | "tableHint" | "deskHint"
}[] = [
  { value: "room", label: "rooms", stored: "qr_room", hint: "roomHint" },
  { value: "table", label: "tables", stored: "qr_table", hint: "tableHint" },
  { value: "desk", label: "desk", stored: "qr_front_desk", hint: "deskHint" },
]
const SOURCE_LABEL: Record<string, "room" | "table" | "desk"> = {
  qr_room: "room",
  qr_table: "table",
  qr_front_desk: "desk",
}

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
  const context = canvas.getContext("2d")
  context?.drawImage(image, 0, 0, 1024, 1024)
  save(name, canvas.toDataURL("image/png"))
}

export function QrCodesBoard({ labels }: { labels: QrCodesLabels }) {
  const { data: stats } = useSuspenseQuery(orpc.hotel.captureStats.queryOptions())
  const [source, setSource] = useState<CaptureSource>("room")
  const generate = useMutation(
    orpc.hotel.qrCodes.mutationOptions({ onError: (error: Error) => toast.error(errorMessage(error)) }),
  )
  const current = SOURCES.find((item) => item.value === source) ?? SOURCES[0]!
  const currentLabel = labels[current.label]
  const guestsAt = (location: string | null) =>
    stats.find((row) => row.source === current.stored && row.location === location)?.guests ?? 0

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const spots = parseSpots(String(new FormData(event.currentTarget).get("spots") ?? ""))
    generate.mutate({ source, spots })
  }

  return (
    <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-3">
      <Card className="self-start">
        <CardHeader>
          <CardTitle>{labels.newTitle}</CardTitle>
          <CardDescription>{labels.newDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="source">{labels.where}</FieldLabel>
                <select
                  id="source"
                  value={source}
                  onChange={(event) => setSource(event.target.value as CaptureSource)}
                  className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base md:text-sm"
                >
                  {SOURCES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {labels[item.label]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="spots">{labels.spots}</FieldLabel>
                <Textarea id="spots" name="spots" rows={4} placeholder={labels[current.hint]} />
                <FieldDescription>{labels.spotsHint}</FieldDescription>
              </Field>
              <Button type="submit" disabled={generate.isPending}>
                {labels.generate}
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <div className="grid content-start gap-4 lg:col-span-2">
        {generate.data && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {generate.data.map((code) => (
              <Card key={code.url}>
                <CardHeader>
                  <CardTitle>{code.location ?? currentLabel}</CardTitle>
                  <CardDescription>
                    {labels.guestsSoFar.replace("{count}", String(guestsAt(code.location)))}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {/* biome-ignore lint/performance/noImgElement: a generated data url, nothing to optimize */}
                  <img
                    src={svgUrl(code.svg)}
                    alt={labels.alt.replace("{spot}", code.location ?? currentLabel)}
                    className="w-full"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => save(fileName(source, code.location, "svg"), svgUrl(code.svg))}
                    >
                      <DownloadIcon /> SVG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => savePng(fileName(source, code.location, "png"), code.svg)}
                    >
                      <DownloadIcon /> PNG
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>{labels.tableTitle}</CardTitle>
            <CardDescription>{labels.tableDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.length === 0 ? (
              <p className="text-muted-foreground text-sm">{labels.empty}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-muted-foreground">
                    <th className="py-1 text-start font-medium">{labels.colWhere}</th>
                    <th className="py-1 text-start font-medium">{labels.colSpot}</th>
                    <th className="py-1 text-end font-medium">{labels.colGuests}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((row) => (
                    <tr key={`${row.source}-${row.location}`} className="border-t">
                      <td className="py-1.5">
                        {SOURCE_LABEL[row.source] ? labels[SOURCE_LABEL[row.source]!] : row.source}
                      </td>
                      <td className="py-1.5">{row.location ?? "-"}</td>
                      <td className="py-1.5 text-end">{row.guests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
