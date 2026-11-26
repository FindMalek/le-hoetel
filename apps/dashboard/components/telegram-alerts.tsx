"use client"

import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

interface Props {
  linked: boolean
  botConfigured: boolean
  readOnly: boolean
}

export function TelegramAlerts({ linked, botConfigured, readOnly }: Props) {
  const t = useTranslations("managerAlerts")
  const router = useRouter()
  const [link, setLink] = useState<{ code: string; url: string | null } | null>(null)
  const onError = (error: unknown) => toast.error(errorMessage(error))

  const create = useMutation(orpc.hotel.alerts.link.mutationOptions({ onSuccess: setLink, onError }))
  const test = useMutation(
    orpc.hotel.alerts.test.mutationOptions({
      onSuccess: ({ channel }) =>
        channel === "telegram"
          ? toast.success(t("testTelegram"))
          : channel === "email"
            ? toast.message(t("testEmail"))
            : toast.error(t("testNone")),
      onError,
    }),
  )
  const unlink = useMutation(
    orpc.hotel.alerts.unlink.mutationOptions({
      onSuccess: () => {
        setLink(null)
        toast.success(t("disconnected"))
        router.refresh()
      },
      onError,
    }),
  )

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-2" role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-sm">{t("title")}</span>
          <StatusBadge tone={!botConfigured ? "warning" : linked ? "success" : "neutral"}>
            {!botConfigured ? t("badge.unavailable") : linked ? t("badge.connected") : t("badge.notConnected")}
          </StatusBadge>
        </div>
        <p className="text-pretty text-muted-foreground text-sm">
          {!botConfigured ? t("notConfigured") : linked ? t("linked") : t("notLinked")}
        </p>
      </div>
      {link?.url ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{t("step")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button render={<a href={link.url} target="_blank" rel="noreferrer" />} nativeButton={false}>
              {t("open")}
            </Button>
            <Button variant="outline" onClick={() => router.refresh()}>
              {t("refresh")}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm tabular-nums" dir="ltr">
            {t("code", { code: link.code })}
          </p>
        </div>
      ) : null}
      {readOnly ? null : (
        <div className="flex flex-wrap gap-3">
          {botConfigured ? (
            <Button variant={linked ? "outline" : "default"} loading={create.isPending} onClick={() => create.mutate()}>
              {linked ? t("reconnect") : t("connect")}
            </Button>
          ) : null}
          <Button variant="outline" loading={test.isPending} onClick={() => test.mutate()}>
            {t("testButton")}
          </Button>
          {linked ? (
            <Button variant="ghost" loading={unlink.isPending} onClick={() => unlink.mutate()}>
              {t("disconnect")}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
