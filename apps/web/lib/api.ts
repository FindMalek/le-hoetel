import "server-only"
import { createServerClient } from "@ritorno/orpc/server"
import { headers } from "next/headers"

/** The api does the work; the web app only renders. Calls fail soft so a down api never blanks the page. */
const api = createServerClient()

/** For guest writes: forwards the guest's ip so the api rate limits the guest, not this server. */
export const guestApi = createServerClient(async (): Promise<Record<string, string>> => {
  const forwarded = (await headers()).get("x-forwarded-for")
  return forwarded ? { "x-forwarded-for": forwarded } : {}
})

export const getServices = () => api.status.services().catch(() => null)

export const getUnsubscribePage = (token: string) => api.public.unsubscribe.get({ token }).catch(() => null)

export const getOfferPage = (token: string) => api.public.offer({ token }).catch(() => null)
export const updateChannels = (token: string, choices: { email?: boolean; whatsapp?: boolean }) =>
  api.public.unsubscribe.update({ token, ...choices })
export const stopEverything = (token: string) => api.public.unsubscribe.all({ token })

export const getSurveyPage = (token: string) => api.public.survey.get({ token }).catch(() => null)
export const submitSurvey = (input: Parameters<typeof api.public.survey.submit>[0]) =>
  guestApi.public.survey.submit(input)
export const getReviewUrl = (token: string) => api.public.survey.review({ token }).catch(() => null)
