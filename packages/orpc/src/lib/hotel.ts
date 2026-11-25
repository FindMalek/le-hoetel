import { HOTEL_ROLES, type HotelRole } from "@le-hoetel/common/hotel"
import { organization } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { eq } from "drizzle-orm"
import type { Context } from "../context"
import { activeMembership } from "./org"

export interface ActiveHotel {
  hotelId: string
  role: HotelRole
  /** The app admin acting on a hotel they are not a member of. */
  superAdmin: boolean
}

export const HOTEL_HEADER = "x-hotel-id"

export const bestRole = (stored: string): HotelRole | null =>
  HOTEL_ROLES.find((role) => stored.split(",").includes(role)) ?? null

/**
 * The hotel a call acts on. Members get the hotel of their session, re-checked against `member`. The app admin
 * (user role `admin`) may name any hotel with the `x-hotel-id` header and then acts as its owner. For everyone
 * else the header can only repeat their own hotel: naming another one is refused, never silently ignored.
 */
export async function resolveHotel(context: Pick<Context, "db" | "session" | "headers">): Promise<ActiveHotel> {
  const requested = context.headers.get(HOTEL_HEADER)
  if (context.session?.user.role === "admin" && requested) {
    const [row] = await context.db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, requested))
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Hotel not found." })
    return { hotelId: row.id, role: "owner", superAdmin: true }
  }
  const membership = await activeMembership(context)
  if (!membership) throw new ORPCError("FORBIDDEN", { message: "Pick a hotel first." })
  if (requested && requested !== membership.organizationId) {
    throw new ORPCError("FORBIDDEN", { message: "That is not your hotel." })
  }
  const role = bestRole(membership.role)
  if (!role) throw new ORPCError("FORBIDDEN", { message: "Your role has no access to this hotel." })
  return { hotelId: membership.organizationId, role, superAdmin: false }
}
