"use client"

import { browserClient, orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { ConfirmDialog } from "@le-hoetel/ui/components/confirm-dialog"
import { FormSection } from "@le-hoetel/ui/components/form-section"
import { Input } from "@le-hoetel/ui/components/input"
import { Label } from "@le-hoetel/ui/components/label"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DownloadIcon, SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { GuestActions } from "@/components/guest-actions"
import { download, today } from "@/lib/download"

export function GuestDataPanel({ hotelName }: { hotelName: string }) {
  const t = useTranslations("guestData")
  const router = useRouter()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const fail = () => toast.error(t("error"))

  const results = useQuery({
    ...orpc.guests.list.queryOptions({ input: { q: search.trim(), limit: 6 } }),
    enabled: search.trim().length >= 2,
  })
  const total = useQuery(orpc.guests.list.queryOptions({ input: { limit: 1 } }))
  const count = total.data?.total ?? 0

  const exportAll = useMutation({
    mutationFn: async (format: "json" | "csv") => {
      if (format === "json") {
        const data = await browserClient.guests.exportAll()
        return download(`guests-${today()}.json`, JSON.stringify(data, null, 2), "application/json")
      }
      const { filename, csv } = await browserClient.guests.exportCsv({})
      download(filename, csv, "text/csv;charset=utf-8")
    },
    onSuccess: () => toast.success(t("exported")),
    onError: fail,
  })
  const removeAll = useMutation({
    mutationFn: () => browserClient.guests.removeAll({ confirmCount: count }),
    onSuccess: async () => {
      setConfirming(false)
      setTyped("")
      await queryClient.invalidateQueries({ queryKey: orpc.guests.key() })
      router.refresh()
      toast.success(t("deleted"))
    },
    onError: fail,
  })

  const typedOk = typed.trim().toLowerCase() === hotelName.toLowerCase()

  return (
    <div className="flex flex-col">
      <FormSection title={t("exportTitle")} description={t("exportDescription")}>
        <p className="text-sm tabular-nums">{t("count", { count })}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!count} loading={exportAll.isPending} onClick={() => exportAll.mutate("csv")}>
            <DownloadIcon data-icon="inline-start" />
            {t("exportCsv")}
          </Button>
          <Button variant="outline" disabled={!count} loading={exportAll.isPending} onClick={() => exportAll.mutate("json")}>
            <DownloadIcon data-icon="inline-start" />
            {t("exportJson")}
          </Button>
        </div>
      </FormSection>

      <FormSection title={t("guestTitle")} description={t("guestDescription")}>
        <div className="relative">
          <Label htmlFor="data-search" className="sr-only">
            {t("search")}
          </Label>
          <SearchIcon aria-hidden className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            id="data-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search")}
            enterKeyHint="search"
            autoComplete="off"
            className="ps-9"
          />
        </div>
        {results.data && !results.data.items.length && <p className="text-muted-foreground text-sm">{t("noResults")}</p>}
        {results.data && results.data.items.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border bg-card">
            {results.data.items.map((guest) => (
              <li key={guest.id} className="flex flex-col gap-3 p-4">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{guest.name}</span>
                  <bdi dir="ltr" className="text-muted-foreground text-sm tabular-nums">
                    {guest.phoneE164}
                  </bdi>
                </span>
                <div className="flex flex-wrap gap-2">
                  <GuestActions
                    id={guest.id}
                    name={guest.name}
                    canExport
                    canDelete
                    onDeleted={() => void queryClient.invalidateQueries({ queryKey: orpc.guests.key() })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection title={t("dangerTitle")} description={t("dangerDescription")}>
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-sm">{t("deleteAllText", { count })}</p>
          <Button variant="outline" className="w-fit text-destructive" disabled={!count} onClick={() => setConfirming(true)}>
            {t("deleteAll")}
          </Button>
        </div>
      </FormSection>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          setConfirming(open)
          if (!open) setTyped("")
        }}
        destructive
        pending={removeAll.isPending}
        confirmDisabled={!typedOk}
        title={t("deleteAllTitle")}
        description={t("deleteAllBody", { count, hotel: hotelName })}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => removeAll.mutate()}
      >
        <div className="flex flex-col gap-2 text-sm">
          <Label htmlFor="confirm-word">{t("typeName", { hotel: hotelName })}</Label>
          <Input id="confirm-word" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" />
        </div>
      </ConfirmDialog>
    </div>
  )
}
