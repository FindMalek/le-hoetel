import "server-only"
import { createServerClient } from "@le-hoetel/orpc/server"

/** The api does the work; the web app only renders. Calls fail soft so a down api never blanks the page. */
const api = createServerClient()

export const getServices = () => api.status.services().catch(() => null)

export const getUnsubscribePage = (token: string) => api.public.unsubscribe.get({ token }).catch(() => null)

export const getOfferPage = (token: string) => api.public.offer({ token }).catch(() => null)
export const updateChannels = (token: string, choices: { email?: boolean; whatsapp?: boolean }) =>
  api.public.unsubscribe.update({ token, ...choices })
export const stopEverything = (token: string) => api.public.unsubscribe.all({ token })
