"use client"

import { errorMessage, isConflict } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { useMutation } from "@tanstack/react-query"
import { CheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useRefreshLists } from "@/lib/use-refresh-lists"

export function MarkContactedButton({ caseId, updatedAt, name }: { caseId: string; updatedAt: Date; name: string }) {
  const t = useTranslations("contact")
  const tCases = useTranslations("feedbackCases")
  const router = useRouter()
  const refreshLists = useRefreshLists()
  const refresh = () => {
    void refreshLists()
    router.refresh()
  }
  const mark = useMutation(
    orpc.feedbackCases.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("marked"))
        refresh()
      },
      onError: (error) => {
        if (!isConflict(error)) return toast.error(errorMessage(error))
        toast.error(tCases("conflict"))
        refresh()
      },
    }),
  )
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={t("markContactedName", { name })}
      loading={mark.isPending}
      onClick={() => mark.mutate({ id: caseId, updatedAt, status: "contacted" })}
    >
      <CheckIcon data-icon="inline-start" />
      {t("markContacted")}
    </Button>
  )
}
