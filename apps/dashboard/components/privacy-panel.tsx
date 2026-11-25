"use client"

import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { ConfirmDialog } from "@le-hoetel/ui/components/confirm-dialog"
import { Input } from "@le-hoetel/ui/components/input"
import { useMutation } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { FormField } from "./form-field"

function download(name: string, content: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }))
  const link = Object.assign(document.createElement("a"), { href: url, download: name })
  link.click()
  URL.revokeObjectURL(url)
}

export function PrivacyPanel({ email: ownEmail }: { email: string }) {
  const t = useTranslations("settings")
  const [email, setEmail] = useState("")
  const [open, setOpen] = useState(false)
  const onError = (error: Error) => toast.error(errorMessage(error))
  const exportData = useMutation(
    orpc.privacy.export.mutationOptions({ onError, onSuccess: (result) => download("my-data.json", result) }),
  )
  const remove = useMutation(
    orpc.privacy.deleteAccount.mutationOptions({ onError, onSuccess: () => window.location.assign("/sign-in") }),
  )
  const matches = email.trim().toLowerCase() === ownEmail.toLowerCase()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">{t("exportHint")}</p>
        <Button
          variant="outline"
          className="self-start max-md:w-full"
          loading={exportData.isPending}
          onClick={() => exportData.mutate({})}
        >
          <DownloadIcon data-icon="inline-start" />
          {t("export")}
        </Button>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-destructive/30 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium text-destructive text-sm">{t("deleteTitle")}</h3>
          <p className="text-muted-foreground text-sm">{t("deleteHint")}</p>
        </div>
        <FormField id="delete-email" label={t("deleteConfirmLabel", { email: ownEmail })}>
          {(aria) => (
            <Input
              {...aria}
              dir="ltr"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </FormField>
        <Button
          variant="destructive"
          className="self-start max-md:w-full"
          disabled={!matches}
          onClick={() => setOpen(true)}
        >
          {t("delete")}
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("deleteTitle")}
        description={t("deleteConfirmBody")}
        confirmLabel={t("delete")}
        cancelLabel={t("cancel")}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate({ email: email.trim() })}
      />
    </div>
  )
}
