"use client"

import { authClient } from "@le-hoetel/auth/client"
import { orgClient } from "@le-hoetel/auth/orgs"
import { Button } from "@le-hoetel/ui/components/button"
import { InlineAlert } from "@le-hoetel/ui/components/inline-alert"
import { Skeleton } from "@le-hoetel/ui/components/skeleton"
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
    orgClient.organization.getInvitation({ query: { id } }).then(({ data, error }) => {
      if (!live) return
      if (data) setState({ kind: "ready", invitation: data })
      else setState({ kind: error?.status === 403 ? "wrong" : "invalid" })
    })
    return () => {
      live = false
    }
  }, [id])

  const accept = async () => {
    setBusy(true)
    setFailed(false)
    const { error } = await orgClient.organization.acceptInvitation({ invitationId: id })
    if (error) {
      setFailed(true)
      return setBusy(false)
    }
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
          <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight">
            {t("invitation.title", { hotel: invitation.organizationName })}
          </h1>
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
      <span className="grid size-12 place-items-center rounded-lg bg-muted">
        <MailXIcon aria-hidden />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-balance font-heading font-semibold text-3xl tracking-tight">
          {t("invitation.invalidTitle")}
        </h1>
        <p className="text-pretty text-muted-foreground">
          {wrong ? t("invitation.wrongAccount") : t("invitation.invalid")}
        </p>
      </div>
      {wrong ? (
        <Button variant="outline" size="lg" onClick={switchAccount}>
          {t("invitation.switchAccount")}
        </Button>
      ) : null}
    </div>
  )
}
