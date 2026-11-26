"use client"

import { browserClient, orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { useMutation } from "@tanstack/react-query"
import { CheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useRefreshLists } from "@/lib/use-refresh-lists"

/** One tap "the guest is here again", with a short undo on the toast. */
export function MarkVisitButton({
  guestId,
  visitedToday,
  className,
}: {
  guestId: string
  visitedToday: boolean
  className?: string
}) {
  const t = useTranslations("guests.finder")
  const router = useRouter()
  const refreshLists = useRefreshLists()
  const refresh = () => {
    void refreshLists()
    router.refresh()
  }
  const undo = (visitId: string) =>
    browserClient.guests
      .undoVisit({ id: guestId, visitId })
      .then(() => {
        toast.success(t("undone"))
        refresh()
      })
      .catch(() => toast.error(t("error")))
  const mark = useMutation(
    orpc.guests.markVisit.mutationOptions({
      onSuccess: ({ visitId }) => {
        if (visitId) {
          toast.success(t("marked"), {
            duration: 10_000,
            action: { label: t("undo"), onClick: () => undo(visitId) },
            classNames: { actionButton: "h-11! px-4!" },
          })
        } else toast.info(t("alreadyCounted"))
        refresh()
      },
      onError: () => toast.error(t("markError")),
    }),
  )
  return (
    <Button
      type="button"
      size="lg"
      className={className}
      disabled={visitedToday}
      loading={mark.isPending}
      onClick={() => mark.mutate({ id: guestId })}
    >
      <CheckIcon data-icon="inline-start" />
      {visitedToday ? t("markedToday") : t("markVisit")}
    </Button>
  )
}
