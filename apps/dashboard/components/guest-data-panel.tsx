"use client"

import { orgClient } from "@le-hoetel/auth/orgs"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { browserClient, orpc } from "@le-hoetel/orpc/react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@le-hoetel/ui/components/alert-dialog"
import { Button } from "@le-hoetel/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import { Input } from "@le-hoetel/ui/components/input"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

interface Copy {
  forbidden: string
  hotelTitle: string
  hotelDescription: string
  exportJson: string
  exportCsv: string
  deleteAll: string
  deleteAllTitle: string
  deleteAllBody: string
  typeName: string
  cancel: string
  confirm: string
  deleted: string
  exported: string
  guestTitle: string
  guestDescription: string
  search: string
  noResults: string
  deleteGuest: string
  deleteGuestTitle: string
  deleteGuestBody: string
  error: string
}

const format = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""))

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = Object.assign(document.createElement("a"), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

const day = () => new Date().toISOString().slice(0, 10)

interface Target {
  /** Shown in the dialog text. */
  label: string
  confirmWord?: string
  body: string
  run: () => Promise<unknown>
}

export function GuestDataPanel({ hotelName, copy }: { hotelName: string; copy: Copy }) {
  const { data: member, isPending } = orgClient.useActiveMember()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [target, setTarget] = useState<Target | null>(null)
  const [typed, setTyped] = useState("")
  const fail = (error: unknown) => toast.error(errorMessage(error) || copy.error)

  const results = useQuery({
    ...orpc.guests.list.queryOptions({ input: { q: search.trim(), limit: 8 } }),
    enabled: search.trim().length >= 2,
  })
  const total = useQuery(orpc.guests.list.queryOptions({ input: { limit: 1 } }))

  const exportJson = useMutation({
    mutationFn: async (id?: string) => {
      const data = id ? await browserClient.guests.export({ id }) : await browserClient.guests.exportAll()
      download(`guests-${day()}.json`, JSON.stringify(data, null, 2), "application/json")
    },
    onSuccess: () => toast.success(copy.exported),
    onError: fail,
  })
  const exportCsv = useMutation({
    mutationFn: async (id?: string) => {
      const { filename, csv } = await browserClient.guests.exportCsv({ id })
      download(filename, csv, "text/csv;charset=utf-8")
    },
    onSuccess: () => toast.success(copy.exported),
    onError: fail,
  })
  const confirm = useMutation({
    mutationFn: async () => target?.run(),
    onSuccess: async () => {
      setTarget(null)
      setTyped("")
      await queryClient.invalidateQueries({ queryKey: orpc.guests.key() })
      toast.success(copy.deleted)
    },
    onError: fail,
  })

  const roles = (member?.role ?? "").split(",")
  if (isPending) return null
  if (!roles.includes("owner") && !roles.includes("manager")) {
    return <p className="text-muted-foreground">{copy.forbidden}</p>
  }

  const count = total.data?.total ?? 0
  const busy = exportJson.isPending || exportCsv.isPending
  const typedOk = !target?.confirmWord || typed.trim().toLowerCase() === target.confirmWord.toLowerCase()

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.hotelTitle}</CardTitle>
          <CardDescription>{copy.hotelDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => exportJson.mutate(undefined)}>
            {copy.exportJson}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => exportCsv.mutate(undefined)}>
            {copy.exportCsv}
          </Button>
          <Button
            variant="destructive"
            disabled={!count}
            onClick={() =>
              setTarget({
                label: copy.deleteAllTitle,
                confirmWord: hotelName,
                body: format(copy.deleteAllBody, { count, hotel: hotelName }),
                run: () => browserClient.guests.removeAll({ confirmCount: count }),
              })
            }
          >
            {copy.deleteAll}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.guestTitle}</CardTitle>
          <CardDescription>{copy.guestDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
          />
          {results.data && !results.data.items.length ? (
            <p className="text-muted-foreground text-sm">{copy.noResults}</p>
          ) : null}
          <ul className="grid gap-2">
            {results.data?.items.map((guest) => (
              <li key={guest.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{guest.name}</span>
                  <bdi className="text-muted-foreground text-sm">{guest.phoneE164}</bdi>
                </span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => exportJson.mutate(guest.id)}>
                    JSON
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => exportCsv.mutate(guest.id)}>
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      setTarget({
                        label: copy.deleteGuestTitle,
                        body: format(copy.deleteGuestBody, { name: guest.name }),
                        run: () => browserClient.guests.remove({ id: guest.id }),
                      })
                    }
                  >
                    {copy.deleteGuest}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null)
            setTyped("")
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.label}</AlertDialogTitle>
            <AlertDialogDescription>{target?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          {target?.confirmWord ? (
            <div className="grid gap-1 text-sm">
              <label htmlFor="confirm-word">{format(copy.typeName, { hotel: target.confirmWord })}</label>
              <Input
                id="confirm-word"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.cancel}</AlertDialogCancel>
            <Button variant="destructive" disabled={!typedOk || confirm.isPending} onClick={() => confirm.mutate()}>
              {copy.confirm}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
