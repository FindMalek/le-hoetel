import { hotelRoles } from "@ritorno/auth/access"
import type { HotelRole } from "@ritorno/common/hotel"

export type HotelPermission = Parameters<(typeof hotelRoles)["owner"]["authorize"]>[0]

/** What the shell knows about who is looking: the app admin or not, and their role on the hotel on screen (null with none). */
export interface Viewer {
  admin: boolean
  role: HotelRole | null
}

/** The same rule the api's `can` applies, so a page never offers what the api would refuse. */
export const allows = (role: HotelRole | null, permission: HotelPermission): boolean =>
  role !== null && hotelRoles[role].authorize(permission).success
