import type { ApiEnv } from "@ritorno/env/api"
import { errorSummary, maskText, redact } from "@ritorno/logger"
import * as Sentry from "@sentry/bun"

type ErrorEvent = Sentry.ErrorEvent

const PARAMS = /\nparams: [\s\S]*$/

/** Drops drizzle query params from error messages, masks phone and email shaped text and blanks guest data keys, before anything leaves for GlitchTip. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const text = (value: string | undefined) => (value === undefined ? value : maskText(value.replace(PARAMS, "")))
  for (const exception of event.exception?.values ?? []) exception.value = text(exception.value)
  if (event.message) event.message = text(event.message)
  if (event.extra) event.extra = redact(event.extra) as ErrorEvent["extra"]
  if (event.request)
    event.request = {
      ...event.request,
      data: undefined,
      cookies: undefined,
      headers: undefined,
      query_string: undefined,
    }
  event.breadcrumbs = event.breadcrumbs?.map((crumb) => ({
    ...crumb,
    message: text(crumb.message),
    data: crumb.data && (redact(crumb.data) as typeof crumb.data),
  }))
  return event
}

export function initSentry(env: ApiEnv) {
  Sentry.init({ dsn: env.GLITCHTIP_DSN, environment: env.DEPLOY_ENV, beforeSend: scrubEvent })
}

/** A failed job goes to GlitchTip with its name and id only: the payload and the raw error can hold guest data. */
export function captureJobFailure(name: string, id: string, error: unknown) {
  const { name: errorName, code } = errorSummary(error)
  console.error("job failed", { job: name, jobId: id, error: errorName, code })
  Sentry.captureException(new Error(`job ${name} failed (${errorName}${code ? ` ${code}` : ""})`), {
    tags: { job: name, jobId: id },
  })
}
