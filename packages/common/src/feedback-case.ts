/** Safe for client code, unlike `survey.ts` which signs tokens with node:crypto. */
export const FEEDBACK_CASE_STATUSES = ["new", "contacted", "resolved"] as const
export type FeedbackCaseStatus = (typeof FEEDBACK_CASE_STATUSES)[number]
export const FEEDBACK_NOTES_MAX = 2000
