"use client"

import { FEEDBACK_CASE_STATUSES, FEEDBACK_NOTES_MAX, type FeedbackCaseStatus } from "@ritorno/common/feedback-case"
import { errorMessage, isConflict } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { FormField } from "@ritorno/ui/components/form-field"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { Textarea } from "@ritorno/ui/components/textarea"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

export function FeedbackCaseForm(props: {
  id: string
  status: FeedbackCaseStatus
  notes: string | null
  updatedAt: Date
}) {
  const t = useTranslations("feedbackCases")
  const router = useRouter()
  const [status, setStatus] = useState(props.status)
  const [notes, setNotes] = useState(props.notes ?? "")
  const save = useMutation(
    orpc.feedbackCases.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("saved"))
        router.refresh()
      },
      onError: (error) => {
        if (!isConflict(error)) return void toast.error(errorMessage(error))
        // The refresh remounts the form with what the colleague saved.
        toast.error(t("conflict"))
        router.refresh()
      },
    }),
  )

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate({ id: props.id, updatedAt: props.updatedAt, status, notes })
      }}
    >
      <SegmentedControl
        block
        label={t("columns.status")}
        value={status}
        onValueChange={setStatus}
        options={FEEDBACK_CASE_STATUSES.map((value) => ({ value, label: t(`status.${value}`) }))}
      />
      <FormField label={t("notes")} hint={t("notesHint")}>
        {(field) => (
          <Textarea
            {...field}
            dir="auto"
            maxLength={FEEDBACK_NOTES_MAX}
            placeholder={t("notesPlaceholder")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
      </FormField>
      <Button type="submit" className="coarse:h-11 md:w-fit md:self-end" loading={save.isPending}>
        {t("save")}
      </Button>
    </form>
  )
}
