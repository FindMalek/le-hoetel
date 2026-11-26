"use client"

import { authClient } from "@ritorno/auth/client"
import { orgClient } from "@ritorno/auth/orgs"
import { browserClient } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { MailXIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

interface Invitation {
  organizationName: string
  inviterEmail: string
  role: string
}

type State = { kind: "loading" } | { kind: "ready"; invitation: Invitation } | { kind: "wrong" } | { kind: "invalid" }

const ROLES = ["owner", "manager", "staff"] as const
type Role = (typeof ROLES)[number]
const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value)

export function InvitationCard({ id }: { id: string }) {
  const t = useTranslations("auth")
  const [state, setState] = useState<State>({ kind: "loading" })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    browserClient.me
      .invitation({ id })
      .then((invitation) => live && setState({ kind: "ready", invitation }))
      .catch((error: { code?: string }) => live && setState({ kind: error.code === "FORBIDDEN" ? "wrong" : "invalid" }))
    return () => {
      live = false
    }
  }, [id])

  const accept = async () => {
    setBusy(true)
    setFailed(false)
    const { data, error } = await orgClient.organization.acceptInvitation({ invitationId: id })
    if (error) {
      setFailed(true)
      return setBusy(false)
    }
    // Accepting only updates the session row: set-active also rewrites the cached session cookie, else no hotel for minutes.
    await orgClient.organization.setActive({ organizationId: data.invitation.organizationId })
    window.location.assign("/")
  }

  const switchAccount = async () => {
    await authClient.signOut()
    window.location.assign(`/sign-in?next=${encodeURIComponent(`/accept-invitation/${id}`)}`)
  }

  if (state.kind === "loading")
    return (
      <div role="status" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )

  if (state.kind === "ready") {
    const { invitation } = state
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-h1">{t("invitation.title", { hotel: invitation.organizationName })}</h1>
          <p className="text-pretty text-muted-foreground">
            {t("invitation.description", {
              inviter: `\u2068${invitation.inviterEmail}\u2069`,
              role: isRole(invitation.role) ? t(`invitation.role.${invitation.role}`) : invitation.role,
            })}
          </p>
        </div>
        {failed ? <InlineAlert tone="error">{t("errors.generic")}</InlineAlert> : null}
        <Button size="lg" loading={busy} onClick={accept}>
          {t("invitation.accept")}
        </Button>
      </div>
    )
  }

  const wrong = state.kind === "wrong"
  return (
    <div className="flex flex-col gap-6">
      <span className="grid size-12 place-items-center rounded-full bg-surface">
        <MailXIcon aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-balance text-h1">{t("invitation.invalidTitle")}</h1>
        <p className="text-pretty text-muted-foreground">
          {wrong ? t("invitation.wrongAccount") : t("invitation.invalid")}
        </p>
      </div>
      {wrong ? (
        <Button variant="secondary" size="lg" onClick={switchAccount}>
          {t("invitation.switchAccount")}
        </Button>
      ) : null}
    </div>
  )
}
