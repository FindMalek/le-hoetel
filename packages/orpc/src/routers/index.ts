import type { RouterClient } from "@orpc/server"
import { adminRouter, meRouter } from "./account"
import { auditRouter } from "./audit"
import { emailsRouter } from "./emails"
import { feedbackRouter } from "./feedback"
import { guestsRouter } from "./guests"
import { adminHotelsRouter, hotelLogoRouter, hotelRouter } from "./hotel"
import { inboxAdminRouter, inboxRouter } from "./inbox"
import { jobsRouter } from "./jobs"
import { messagesRouter } from "./messages"
import { notesRouter } from "./notes"
import { notificationRouter } from "./notification"
import { offersRouter } from "./offers"
import { overviewRouter } from "./overview"
import { privacyRouter } from "./privacy"
import { publicRouter } from "./public"
import { statusRouter } from "./status"

const notes = {
  ...notesRouter,
}

const admin = {
  ...adminRouter,
  inbox: inboxAdminRouter,
  audit: auditRouter,
  hotels: adminHotelsRouter,
  notification: notificationRouter,
}

/** One router, namespaced: `public` needs no session, everything else does (and `admin` needs the admin role). */
export const appRouter = {
  public: publicRouter,
  feedback: feedbackRouter,
  hotel: { ...hotelRouter, logo: hotelLogoRouter },
  emails: emailsRouter,
  guests: guestsRouter,
  messages: messagesRouter,
  offers: offersRouter,
  overview: overviewRouter,
  me: meRouter,
  notes,
  privacy: privacyRouter,
  admin,
  inbox: inboxRouter,
  jobs: jobsRouter,
  status: statusRouter,
}

export type AppRouter = typeof appRouter
export type AppRouterClient = RouterClient<AppRouter>
