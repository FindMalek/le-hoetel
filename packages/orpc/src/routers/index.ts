import type { RouterClient } from "@orpc/server"
import { adminRouter, meRouter } from "./account"
import { adminAuditRouter, hotelAuditRouter } from "./audit"
import { adminBalanceRouter, balanceRouter } from "./balance"
import { adminBillingRouter } from "./billing"
import { campaignsRouter } from "./campaigns"
import { emailsRouter } from "./emails"
import { feedbackRouter } from "./feedback"
import { feedbackCasesRouter } from "./feedback-cases"
import { guestsRouter } from "./guests"
import { holidaysRouter } from "./holidays"
import { adminHotelsRouter, captureSpotsRouter, hotelLogoRouter, hotelRouter } from "./hotel"
import { inboxAdminRouter, inboxRouter } from "./inbox"
import { jobsRouter } from "./jobs"
import { leadsRouter } from "./leads"
import { managerAlertsRouter } from "./manager-alerts"
import { messagesRouter } from "./messages"
import { metricsRouter } from "./metrics"
import { notesRouter } from "./notes"
import { notificationRouter } from "./notification"
import { offersRouter } from "./offers"
import { overviewRouter } from "./overview"
import { privacyRouter } from "./privacy"
import { publicRouter } from "./public"
import { statusRouter } from "./status"
import { whatsappScansRouter } from "./whatsapp-scans"

const notes = {
  ...notesRouter,
}

const admin = {
  ...adminRouter,
  inbox: inboxAdminRouter,
  audit: adminAuditRouter,
  billing: adminBillingRouter,
  hotels: { ...adminHotelsRouter, balance: adminBalanceRouter },
  notification: notificationRouter,
}

/** One router, namespaced: `public` needs no session, everything else does (and `admin` needs the admin role). */
export const appRouter = {
  public: publicRouter,
  feedback: feedbackRouter,
  feedbackCases: feedbackCasesRouter,
  campaigns: campaignsRouter,
  holidays: holidaysRouter,
  leads: leadsRouter,
  hotel: {
    ...hotelRouter,
    spots: captureSpotsRouter,
    logo: hotelLogoRouter,
    alerts: managerAlertsRouter,
    balance: balanceRouter,
  },
  emails: emailsRouter,
  guests: guestsRouter,
  messages: messagesRouter,
  offers: offersRouter,
  metrics: metricsRouter,
  overview: overviewRouter,
  me: meRouter,
  audit: hotelAuditRouter,
  notes,
  privacy: privacyRouter,
  admin,
  inbox: inboxRouter,
  jobs: jobsRouter,
  status: statusRouter,
  whatsappScans: whatsappScansRouter,
}

export type AppRouter = typeof appRouter
/** `hotelId`: the hotel on the caller's screen, sent as `x-hotel-id` so the api never answers with another's rows. */
export type CallContext = { hotelId?: string }
export type AppRouterClient = RouterClient<AppRouter, CallContext>
