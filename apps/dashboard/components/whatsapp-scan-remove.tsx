"use client"

import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { useMutation } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

export function WhatsAppScanRemove({ id, guest }: { id: string; guest: string }) {
  const t = useTranslations("whatsappScans")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const remove = useMutation(
    orpc.whatsappScans.remove.mutationOptions({
      onError: (error) => toast.error(errorMessage(error)),
      onSuccess: () => {
        setOpen(false)
        router.refresh()
      },
    }),
  )
  return (
    <>
      <Button
        variant="ghost"
        className="min-h-11 min-w-11"
        aria-label={t("removeFrom", { guest })}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon aria-hidden />
        <span className="md:sr-only">{t("remove")}</span>
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("removeTitle")}
        description={t("removeBody")}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate({ id })}
      />
    </>
  )
}
