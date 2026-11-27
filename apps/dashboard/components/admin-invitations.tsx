"use client"

import { emailSchema } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { useMutation } from "@tanstack/react-query"
import { RotateCwIcon, SendIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { AdminInput } from "@/components/admin-fields"
import { CopyLink } from "@/components/copy-link"

/** Says whether the email left, and reloads the page's list. */
function useSent() {
  const t = useTranslations("adminHotel")
  const router = useRouter()
  return (email: string, emailed: boolean) => {
    if (emailed) toast.success(t("inviteSent", { email }))
    else toast.warning(t("inviteNotSent"))
    router.refresh()
  }
}

export function AdminInvitationActions({
  hotelId,
  invitation,
}: {
  hotelId: string
  invitation: { id: string; email: string }
}) {
  const t = useTranslations("adminHotel")
  const router = useRouter()
  const sent = useSent()
  const [asking, setAsking] = useState(false)
  const target = { id: hotelId, invitationId: invitation.id }

  const resend = useMutation(
    orpc.admin.hotels.invitations.resend.mutationOptions({
      onSuccess: ({ emailed }) => sent(invitation.email, emailed),
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const revoke = useMutation(
    orpc.admin.hotels.invitations.revoke.mutationOptions({
      onSuccess: () => {
        toast.success(t("revoked"))
        setAsking(false)
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  return (
    <div className="flex flex-wrap gap-2">
      <CopyLink size="sm" url={`/accept-invitation/${invitation.id}`} label={t("copyLink")} done={t("linkCopied")} />
      <Button variant="outline" size="sm" loading={resend.isPending} onClick={() => resend.mutate(target)}>
        <RotateCwIcon data-icon="inline-start" />
        {t("resend")}
      </Button>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setAsking(true)}>
        <XIcon data-icon="inline-start" />
        {t("revoke")}
      </Button>
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("revokeTitle", { email: invitation.email })}
        description={t("revokeBody")}
        confirmLabel={t("revoke")}
        cancelLabel={t("keep")}
        destructive
        pending={revoke.isPending}
        onConfirm={() => revoke.mutate(target)}
      />
    </div>
  )
}

export function AdminOwnerInvite({ hotelId }: { hotelId: string }) {
  const t = useTranslations("adminHotel")
  const sent = useSent()
  const [email, setEmail] = useState("")
  const [tried, setTried] = useState(false)
  const address = email.trim().toLowerCase()
  const valid = emailSchema.safeParse(address).success

  const invite = useMutation(
    orpc.admin.hotels.invitations.create.mutationOptions({
      onSuccess: ({ emailed }) => {
        sent(address, emailed)
        setEmail("")
        setTried(false)
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTried(true)
    if (valid) invite.mutate({ id: hotelId, email: address })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <AdminInput
        label={t("ownerEmail")}
        hint={t("ownerEmailHint")}
        error={tried && !valid ? t("ownerEmailError") : undefined}
        type="email"
        inputMode="email"
        dir="ltr"
        autoComplete="off"
        enterKeyHint="send"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Button type="submit" className="self-start" loading={invite.isPending}>
        <SendIcon data-icon="inline-start" className="rtl:-scale-x-100" />
        {t("inviteOwner")}
      </Button>
    </form>
  )
}
