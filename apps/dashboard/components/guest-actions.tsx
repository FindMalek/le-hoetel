"use client"

import { browserClient } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ritorno/ui/components/dropdown-menu"
import { useMutation } from "@tanstack/react-query"
import { DownloadIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { download, today } from "@/lib/download"
import { useRefreshLists } from "@/lib/use-refresh-lists"

export function useGuestExport() {
  const t = useTranslations("guests.detail")
  const run = useMutation({
    mutationFn: async ({ id, format }: { id: string; format: "json" | "csv" }) => {
      if (format === "json") {
        const data = await browserClient.guests.export({ id })
        download(`guest-${today()}.json`, JSON.stringify(data, null, 2), "application/json")
        return
      }
      const { filename, csv } = await browserClient.guests.exportCsv({ id })
      download(filename, csv, "text/csv;charset=utf-8")
    },
    onSuccess: () => toast.success(t("exported")),
    onError: () => toast.error(t("error")),
  })
  return run
}

export function GuestActions({
  id,
  name,
  canExport,
  canDelete,
  menu,
  onDeleted,
}: {
  id: string
  name: string
  canExport: boolean
  canDelete: boolean
  /** One "more" button holding both, where they must not sit next to everyday actions. */
  menu?: boolean
  onDeleted?: () => void
}) {
  const t = useTranslations("guests.detail")
  const tContact = useTranslations("contact")
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const exporter = useGuestExport()
  const refreshLists = useRefreshLists()
  const remove = useMutation({
    mutationFn: () => browserClient.guests.remove({ id }),
    onSuccess: () => {
      toast.success(t("deleted"))
      void refreshLists()
      setConfirming(false)
      if (onDeleted) return onDeleted()
      router.push("/guests")
      router.refresh()
    },
    onError: () => toast.error(t("error")),
  })
  const exportItems = (
    <>
      <DropdownMenuItem onClick={() => exporter.mutate({ id, format: "csv" })}>{t("exportCsv")}</DropdownMenuItem>
      <DropdownMenuItem onClick={() => exporter.mutate({ id, format: "json" })}>{t("exportJson")}</DropdownMenuItem>
    </>
  )
  return (
    <>
      {menu && (canExport || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" aria-label={tContact("more")} loading={exporter.isPending} />}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            {canExport && exportItems}
            {canExport && canDelete && <DropdownMenuSeparator />}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
                <Trash2Icon />
                {t("delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {!menu && canExport && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" loading={exporter.isPending} />}>
            <DownloadIcon data-icon="inline-start" />
            {t("export")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{exportItems}</DropdownMenuContent>
        </DropdownMenu>
      )}
      {!menu && canDelete && (
        <Button variant="outline" className="text-destructive" onClick={() => setConfirming(true)}>
          <Trash2Icon data-icon="inline-start" />
          {t("delete")}
        </Button>
      )}
      {canDelete && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          destructive
          pending={remove.isPending}
          title={t("deleteTitle")}
          description={t("deleteBody", { name })}
          confirmLabel={t("deleteConfirm")}
          cancelLabel={t("cancel")}
          typedConfirmation={{ label: t("deleteType", { name }), expected: name }}
          onConfirm={() => remove.mutate()}
        />
      )}
    </>
  )
}
