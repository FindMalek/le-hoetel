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

/**
 * Staff change one consent after a confirm. Withdrawing is logged as the guest's request. Granting shows the exact
 * wording the guest agrees to, in their language, and is logged as staff.
 */
export function ConsentChange({
  guestId,
  channel,
  granted,
  wording,
}: {
  guestId: string
  channel: ConsentChannel
  granted: boolean
  /** The consent text read to the guest. Without it, granting is not offered. */
  wording?: string
}) {
  const t = useTranslations("guests.detail")
  const tChannel = useTranslations("guests.consent")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const change = useMutation({
    mutationFn: () =>
      browserClient.guests.setConsent({
        guestId,
        channel,
        granted: !granted,
        source: granted ? "guest_request" : "staff",
      }),
    onSuccess: () => {
      setOpen(false)
      toast.success(t(granted ? "withdrawn" : "grantedToast"))
      router.refresh()
    },
    onError: () => toast.error(t("error")),
  })
  if (!granted && !wording) return null
  return (
    <>
      <Button variant="outline" size="sm" className="coarse:h-11" onClick={() => setOpen(true)}>
        {t(granted ? "withdraw" : "grant")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive={granted}
        pending={change.isPending}
        title={t(granted ? "withdrawTitle" : "grantTitle", { channel: tChannel(channel) })}
        description={t(granted ? "withdrawBody" : "grantBody")}
        confirmLabel={t(granted ? "withdrawConfirm" : "grantConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => change.mutate()}
      >
        {!granted && wording ? (
          <blockquote dir="auto" className="rounded-lg border-primary border-s-2 bg-surface p-4 text-sm">
            {wording}
          </blockquote>
        ) : null}
      </ConfirmDialog>
    </>
  )
}

// i18n-used: guests.detail.withdraw
// i18n-used: guests.detail.withdrawTitle
// i18n-used: guests.detail.withdrawBody
// i18n-used: guests.detail.withdrawConfirm
// i18n-used: guests.detail.withdrawn
// i18n-used: guests.detail.grant
// i18n-used: guests.detail.grantTitle
// i18n-used: guests.detail.grantBody
// i18n-used: guests.detail.grantConfirm
// i18n-used: guests.detail.grantedToast
