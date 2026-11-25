"use client"

import type { ConsentChannel } from "@ritorno/common/consent"
import { browserClient } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

export function WithdrawConsent({ guestId, channel }: { guestId: string; channel: ConsentChannel }) {
  const t = useTranslations("guests.detail")
  const tChannel = useTranslations("guests.consent")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const withdraw = useMutation({
    mutationFn: () => browserClient.guests.setConsent({ guestId, channel, granted: false, source: "guest_request" }),
    onSuccess: () => {
      setOpen(false)
      toast.success(t("withdrawn"))
      router.refresh()
    },
    onError: () => toast.error(t("error")),
  })
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {t("withdraw")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        pending={withdraw.isPending}
        title={t("withdrawTitle", { channel: tChannel(channel) })}
        description={t("withdrawBody")}
        confirmLabel={t("withdrawConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => withdraw.mutate()}
      />
    </>
  )
}
