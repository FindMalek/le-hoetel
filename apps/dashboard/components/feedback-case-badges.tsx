import type { FeedbackCaseStatus } from "@ritorno/common/feedback-case"
import { Num } from "@ritorno/ui/components/num"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { getTranslations } from "next-intl/server"

const STATUS_TONE: Record<FeedbackCaseStatus, StatusTone> = {
  new: "warning",
  contacted: "info",
  resolved: "success",
}

export async function CaseStatusBadge({ status }: { status: FeedbackCaseStatus }) {
  const t = await getTranslations("feedbackCases.status")
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
