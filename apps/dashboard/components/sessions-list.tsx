"use client"

import { authClient } from "@ritorno/auth/client"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { ListSkeleton } from "@ritorno/ui/components/loading-state"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LaptopIcon, LogOutIcon, SmartphoneIcon } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

const KEY = ["auth", "sessions"]

/** "Chrome on macOS" from a user agent: enough to recognise a device, nothing more precise. */
function describeAgent(agent: string | null | undefined): { label: string; mobile: boolean } {
  if (!agent) return { label: "", mobile: false }
  const browser = /edg\//i.test(agent)
    ? "Edge"
    : /firefox\//i.test(agent)
      ? "Firefox"
      : /chrome\//i.test(agent)
        ? "Chrome"
        : /safari\//i.test(agent)
          ? "Safari"
          : ""
  const system = /android/i.test(agent)
    ? "Android"
    : /iphone|ipad/i.test(agent)
      ? "iOS"
      : /mac os/i.test(agent)
        ? "macOS"
        : /windows/i.test(agent)
          ? "Windows"
          : /linux/i.test(agent)
            ? "Linux"
            : ""
  return { label: [browser, system].filter(Boolean).join(" · "), mobile: /android|iphone|ipad|mobile/i.test(agent) }
}

export function SessionsList() {
  const t = useTranslations("settings")
  const locale = useLocale()
  const queryClient = useQueryClient()
  const current = authClient.useSession()
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const sessions = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions()
      if (error) throw new Error(error.message)
      return data
    },
  })

  async function signOutEverywhere() {
    setBusy("all")
    const { error } = await authClient.revokeSessions()
    if (error) {
      setBusy(null)
      return void toast.error(error.message ?? t("errors.generic"))
    }
    window.location.assign("/sign-in")
  }

  async function revoke(key: string, call: Promise<{ error: { message?: string } | null }>, done: string) {
    setBusy(key)
    const { error } = await call
    setBusy(null)
    if (error) return void toast.error(error.message ?? t("errors.generic"))
    toast.success(done)
    await queryClient.invalidateQueries({ queryKey: KEY })
  }

  if (sessions.isPending) return <ListSkeleton rows={2} label={t("loading")} />
  if (sessions.error) {
    return (
      <InlineAlert
        tone="error"
        title={t("sessionsFailed")}
        action={
          <Button size="sm" variant="outline" onClick={() => sessions.refetch()}>
            {t("retry")}
          </Button>
        }
      >
        {t("sessionsFailedHint")}
      </InlineAlert>
    )
  }

  const list = [...sessions.data].sort((a, b) => Number(new Date(b.updatedAt)) - Number(new Date(a.updatedAt)))
  const others = list.filter((session) => session.token !== current.data?.session.token)
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y rounded-lg border bg-card">
        {list.map((session) => {
          const isCurrent = session.token === current.data?.session.token
          const { label, mobile } = describeAgent(session.userAgent)
          const Icon = mobile ? SmartphoneIcon : LaptopIcon
          return (
            <li key={session.id} className="flex items-center gap-3 p-4">
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {label || t("unknownDevice")}
                  {isCurrent ? <StatusBadge tone="success">{t("thisDevice")}</StatusBadge> : null}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t("lastActive")} {formatDate(new Date(session.updatedAt), locale)}
                </span>
              </div>
              {isCurrent ? null : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  loading={busy === session.token}
                  onClick={() =>
                    revoke(session.token, authClient.revokeSession({ token: session.token }), t("sessionEnded"))
                  }
                >
                  {t("endSession")}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {others.length > 0 ? (
          <Button
            variant="outline"
            className="max-sm:w-full"
            loading={busy === "others"}
            onClick={() => revoke("others", authClient.revokeOtherSessions(), t("othersEnded"))}
          >
            {t("endOthers")}
          </Button>
        ) : null}
        <Button variant="ghost" className="text-destructive max-sm:w-full" onClick={() => setConfirmAll(true)}>
          <LogOutIcon data-icon="inline-start" className="rtl:-scale-x-100" />
          {t("signOutEverywhere")}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title={t("signOutEverywhereTitle")}
        description={t("signOutEverywhereBody")}
        confirmLabel={t("signOutEverywhere")}
        cancelLabel={t("cancel")}
        destructive
        pending={busy === "all"}
        onConfirm={signOutEverywhere}
      />
    </div>
  )
}
