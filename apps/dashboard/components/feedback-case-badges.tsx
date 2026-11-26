import type { FeedbackCaseStatus } from "@ritorno/common/feedback-case"
import { Num } from "@ritorno/ui/components/num"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { useTranslations } from "next-intl"

const STATUS_TONE: Record<FeedbackCaseStatus, StatusTone> = {
  new: "warning",
  contacted: "info",
  resolved: "success",
}

export function CaseStatusBadge({ status }: { status: FeedbackCaseStatus }) {
  const t = useTranslations("feedbackCases.status")
  return <StatusBadge tone={STATUS_TONE[status]}>{t(status)}</StatusBadge>
}

export const ScoreBadge = ({ nps }: { nps: number }) => (
  <StatusBadge tone={nps >= 7 ? "neutral" : "danger"}>
    <Num value={`${nps}/10`} />
  </StatusBadge>
)

// i18n-used: feedbackCases.status.new
// i18n-used: feedbackCases.status.contacted
// i18n-used: feedbackCases.status.resolved
