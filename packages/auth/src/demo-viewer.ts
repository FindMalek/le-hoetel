import { isDemoViewer } from "@ritorno/common/demo"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"

/** The writes the view only demo account keeps: getting in and out, and picking its own hotel. */
const ALLOWED = ["/sign-in/", "/sign-out", "/organization/set-active", "/admin/stop-impersonating"]

/**
 * Refuses the demo viewer every other auth write (password, email, profile, sessions, team, invitations). Over http
 * only: server calls carry no request, and the ones made for a user sit behind oRPC procedures that refuse it too.
 */
export const refuseDemoViewerWrites = createAuthMiddleware(async (ctx) => {
  if (!ctx.request || ctx.request.method === "GET" || ALLOWED.some((path) => ctx.path.startsWith(path))) return
  const session = await getSessionFromCtx(ctx)
  if (session && isDemoViewer(session.user.email)) {
    throw new APIError("FORBIDDEN", { code: "DEMO_VIEW_ONLY", message: "This demo account is view only." })
  }
})
