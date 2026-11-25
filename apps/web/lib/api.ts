import "server-only"
import { createServerClient } from "@le-hoetel/orpc/server"

/** The api does the work; the web app only renders. Calls fail soft so a down api never blanks the page. */
const api = createServerClient()

export const getRepo = () => api.public.repo().catch(() => null)
export const getServices = () => api.status.services().catch(() => null)

export const getUnsubscribePage = (token: string) => api.public.unsubscribe.get({ token }).catch(() => null)

export const getOfferPage = (token: string) => api.public.offer({ token }).catch(() => null)
