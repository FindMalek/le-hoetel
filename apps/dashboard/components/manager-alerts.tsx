"use client"

import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { useMutation } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

export function ManagerAlerts({ readOnly }: { readOnly: boolean }) {
  const t = useTranslations("managerAlerts")
  const test = useMutation(
    orpc.hotel.alerts.test.mutationOptions({
      onSuccess: ({ sent }) => (sent ? toast.success(t("testSent")) : toast.error(t("testNone"))),
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-2">
        <span className="font-medium text-sm">{t("title")}</span>
        <p className="text-pretty text-muted-foreground text-sm">{t("description")}</p>
      </div>
      {readOnly ? null : (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" loading={test.isPending} onClick={() => test.mutate()}>
            {t("testButton")}
          </Button>
        </div>
      )}
    </div>
  )
}
