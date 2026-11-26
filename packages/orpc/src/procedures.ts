import { ORPCError, os } from "@orpc/server"
import { hotelRoles } from "@ritorno/auth/access"
import { logger } from "@ritorno/logger"
import type { Context } from "./context"
import { type ActiveHotel, resolveHotel } from "./lib/hotel"
import { activeMembership } from "./lib/org"
import { enforceRateLimit, RATE_LIMITS } from "./lib/rate-limit"

export const o = os.$context<Context>()

/** Unexpected errors are logged with the procedure path (a database error as its class and code only); ORPCErrors are answers, not failures. Every call is rate limited per route and caller first. */
const logErrors = o.middleware(async (options) => {
  const route = options.path.join(".")
  await enforceRateLimit(options.context, route, RATE_LIMITS.default)
  try {
    return await options.next()
  } catch (error) {
    if (!(error instanceof ORPCError)) logger.error("procedure failed", { route, err: error })
    throw error
  }
})

export const publicProcedure = o.use(logErrors)

/**
 * Sessions are cookies, so signed-in calls also need `x-csrf-token: orpc`, which the oRPC link sends and a
 * cross-site form can't. That covers the REST (OpenAPI) routes too, not just RPC.
 */
const requireSession = o.middleware(async ({ context, next }) => {
  if (!context.session) throw new ORPCError("UNAUTHORIZED", { message: "Please sign in." })
  // The header only protects cookies: an API key call carries none.
  if (!context.apiKey && context.headers.get("x-csrf-token") !== "orpc") {
    throw new ORPCError("FORBIDDEN", { message: "Missing the x-csrf-token header." })
  }
  return next({ context: { session: context.session, user: context.session.user } })
})

export const protectedProcedure = publicProcedure.use(requireSession)

const requireAdmin = o.middleware(async ({ context, next }) => {
  if (context.session?.user.role !== "admin") throw new ORPCError("FORBIDDEN", { message: "Admins only." })
  return next()
})

export const adminProcedure = protectedProcedure.use(requireAdmin)

const requireOrg = o.middleware(async ({ context, next }) => {
  const membership = await activeMembership(context)
  if (!membership) throw new ORPCError("FORBIDDEN", { message: "Pick an organization first." })
  return next({ context: { org: membership } })
})

/** Signed in, with an active organization the caller is a member of: `context.org` is `{ organizationId, role }`. */
export const orgProcedure = protectedProcedure.use(requireOrg)

const requireHotel = o.middleware(async ({ context, next }) => {
  const hotel = await resolveHotel(context)
  return next({ context: { hotel } })
})

/**
 * Signed in, acting on one hotel: `context.hotel` is `{ hotelId, role, superAdmin }`. Every guest query must filter
 * on `context.hotel.hotelId`, and never on an id taken from the input.
 */
export const hotelProcedure = protectedProcedure.use(requireHotel)

const requireHotelExport = o.middleware(async ({ context, next }) => {
  const hotel = await resolveHotel(context, { readOnlyExport: true })
  return next({ context: { hotel } })
})

/** Like `hotelProcedure`, but the owner of a suspended hotel still gets through: for the read-only guest exports only. */
export const hotelExportProcedure = protectedProcedure.use(requireHotelExport)

type Permission = Parameters<(typeof hotelRoles)["owner"]["authorize"]>[0]

/** Narrows a hotel procedure to roles that hold the permission, e.g. `hotelProcedure.use(can({ guest: ["export"] }))`. */
export const can = (permission: Permission) =>
  o.$context<Context & { hotel: ActiveHotel }>().middleware(async ({ context, next }) => {
    if (!hotelRoles[context.hotel.role].authorize(permission).success) {
      throw new ORPCError("FORBIDDEN", { message: "Your role can't do that." })
    }
    return next()
  })
