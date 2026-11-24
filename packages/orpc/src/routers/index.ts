import type { RouterClient } from "@orpc/server"
import { adminRouter, meRouter } from "./account"
import { auditRouter } from "./audit"
import { feedbackRouter } from "./feedback"
import { guestsRouter } from "./guests"
import { adminHotelsRouter, hotelRouter } from "./hotel"
import { inboxAdminRouter, inboxRouter } from "./inbox"
import { jobsRouter } from "./jobs"
import { notesRouter } from "./notes"
import { notificationRouter } from "./notification"
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
  hotel: hotelRouter,
  guests: guestsRouter,
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
