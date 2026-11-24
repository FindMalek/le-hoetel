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

const SOURCES: { value: CaptureSource; label: string; stored: string; hint: string }[] = [
  { value: "room", label: "Rooms", stored: "qr_room", hint: "101-120, 201-220" },
  { value: "table", label: "Tables", stored: "qr_table", hint: "T1, T2, Terrace" },
  { value: "desk", label: "Front desk", stored: "qr_front_desk", hint: "Leave empty for one code" },
]
const SOURCE_LABEL: Record<string, string> = { qr_room: "Room", qr_table: "Table", qr_front_desk: "Front desk" }

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

export function QrCodesBoard() {
  const { data: stats } = useSuspenseQuery(orpc.hotel.captureStats.queryOptions())
  const [source, setSource] = useState<CaptureSource>("room")
  const generate = useMutation(
    orpc.hotel.qrCodes.mutationOptions({ onError: (error: Error) => toast.error(errorMessage(error)) }),
  )
  const current = SOURCES.find((item) => item.value === source) ?? SOURCES[0]!
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
          <CardTitle>New QR codes</CardTitle>
          <CardDescription>One code per spot, so you see which one captures the most guests.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="source">Where</FieldLabel>
                <select
                  id="source"
                  value={source}
                  onChange={(event) => setSource(event.target.value as CaptureSource)}
                  className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base md:text-sm"
                >
                  {SOURCES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="spots">Spots</FieldLabel>
                <Textarea id="spots" name="spots" rows={4} placeholder={current.hint} />
                <FieldDescription>
                  Names or numbers, split by commas or lines. Ranges like 101-120 work.
                </FieldDescription>
              </Field>
              <Button type="submit" disabled={generate.isPending}>
                Generate
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
                  <CardTitle>{code.location ?? current.label}</CardTitle>
                  <CardDescription>{guestsAt(code.location)} guests so far</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {/* biome-ignore lint/performance/noImgElement: a generated data url, nothing to optimize */}
                  <img src={svgUrl(code.svg)} alt={`QR code ${code.location ?? current.label}`} className="w-full" />
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
            <CardTitle>Guests by spot</CardTitle>
            <CardDescription>Which QR codes bring in guests.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.length === 0 ? (
              <p className="text-muted-foreground text-sm">No guest signed up from a QR code yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-muted-foreground">
                    <th className="py-1 text-start font-medium">Where</th>
                    <th className="py-1 text-start font-medium">Spot</th>
                    <th className="py-1 text-end font-medium">Guests</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((row) => (
                    <tr key={`${row.source}-${row.location}`} className="border-t">
                      <td className="py-1.5">{SOURCE_LABEL[row.source] ?? row.source}</td>
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
