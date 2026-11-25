"use client"

import { authClient } from "@ritorno/auth/client"
import { Badge } from "@ritorno/ui/components/badge"
import { Button } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { ListSkeleton } from "@ritorno/ui/components/loading-state"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LaptopIcon, SmartphoneIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { LocalDate } from "./local-date"

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
  const queryClient = useQueryClient()
  const current = authClient.useSession()
  const [busy, setBusy] = useState<string | null>(null)
  const sessions = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions()
      if (error) throw new Error(error.message)
      return data
    },
  })

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
                  {isCurrent ? <Badge variant="secondary">{t("thisDevice")}</Badge> : null}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t("lastActive")} <LocalDate value={new Date(session.updatedAt)} time />
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
      {others.length > 0 ? (
        <Button
          variant="outline"
          className="self-start max-md:w-full"
          loading={busy === "others"}
          onClick={() => revoke("others", authClient.revokeOtherSessions(), t("othersEnded"))}
        >
          {t("endOthers")}
        </Button>
      ) : null}
    </div>
  )
}
