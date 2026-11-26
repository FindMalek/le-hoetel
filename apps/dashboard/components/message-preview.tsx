"use client"

// i18n-used: messages.preview
import type { HotelLanguage } from "@ritorno/common/hotel"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ritorno/ui/components/dialog"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { LoadingState } from "@ritorno/ui/components/loading-state"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { useQuery } from "@tanstack/react-query"
import { EyeIcon, XIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

/** Opens the stored text of a message that was not really sent. */
export function MessagePreview({
  id,
  language,
  guestName,
}: {
  id: string
  language: HotelLanguage
  guestName: string
}) {
  const t = useTranslations("messages.preview")
  const [open, setOpen] = useState(false)
  const preview = useQuery(orpc.messages.preview.queryOptions({ input: { id }, enabled: open }))
  const dir = language === "ar" ? "rtl" : "ltr"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="coarse:h-11" aria-label={t("viewFor", { name: guestName })} />
        }
      >
        <EyeIcon data-icon="inline-start" />
        {t("view")}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-11/12 grid-cols-1 overflow-y-auto sm:max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("hint")}</DialogDescription>
          </DialogHeader>
          <DialogClose render={<Button variant="ghost" size="icon-sm" className="shrink-0" aria-label={t("close")} />}>
            <XIcon />
          </DialogClose>
        </div>
        {preview.isError ? (
          <InlineAlert tone="error" title={t("error")} />
        ) : !preview.data ? (
          <LoadingState label={t("loading")}>
            <Skeleton className="h-60 w-full" />
          </LoadingState>
        ) : "html" in preview.data ? (
          <div className="flex min-w-0 flex-col gap-3">
            <p className="break-words">
              <span className="text-muted-foreground">{t("subject")}: </span>
              <bdi className="font-medium">{preview.data.subject}</bdi>
            </p>
            {/* An empty sandbox: no scripts, forms, popups or access to the dashboard from the message's html. */}
            <iframe
              title={t("title")}
              sandbox=""
              referrerPolicy="no-referrer"
              srcDoc={preview.data.html}
              className="block h-120 w-full rounded-lg border bg-white"
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-surface p-3">
            <p
              lang={language}
              dir={dir}
              className="me-6 whitespace-pre-line break-words rounded-2xl rounded-ss-sm border bg-background p-3 shadow-xs"
            >
              {preview.data.text}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
