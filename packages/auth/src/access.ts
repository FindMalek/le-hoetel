import type { HotelRole } from "@le-hoetel/common/hotel"
import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements } from "better-auth/plugins/organization/access"

export const statements = {
  ...defaultStatements,
  guest: ["create", "read", "update", "delete", "export", "import"],
  offer: ["create", "read", "update", "delete", "redeem"],
} as const

export const ac = createAccessControl(statements)

/** What each hotel role may do. Staff work the guest list day to day, managers also run the team and the data, owners also own the hotel. */
export const hotelRoles = {
  owner: ac.newRole({
    organization: ["update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    team: ["create", "update", "delete"],
    ac: ["create", "read", "update", "delete"],
    guest: ["create", "read", "update", "delete", "export", "import"],
    offer: ["create", "read", "update", "delete", "redeem"],
  }),
  manager: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    guest: ["create", "read", "update", "delete", "export", "import"],
    offer: ["create", "read", "update", "delete", "redeem"],
    team: [],
    ac: ["read"],
  }),
  staff: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
    guest: ["create", "read", "update"],
    offer: ["read", "redeem"],
    team: [],
    ac: ["read"],
  }),
} satisfies Record<HotelRole, unknown>
