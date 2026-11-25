import type { HotelRole } from "@ritorno/common/hotel"
import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements } from "better-auth/plugins/organization/access"

export const statements = {
  ...defaultStatements,
  guest: ["create", "read", "update", "delete", "export", "import"],
  offer: ["create", "read", "update", "delete", "redeem"],
  campaign: ["create", "read", "update", "delete", "send"],
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
    campaign: ["create", "read", "update", "delete", "send"],
  }),
  manager: ac.newRole({
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    guest: ["create", "read", "update", "delete", "export", "import"],
    offer: ["create", "read", "update", "delete", "redeem"],
    campaign: ["create", "read", "update", "delete", "send"],
    team: [],
    ac: ["read"],
  }),
  staff: ac.newRole({
    organization: [],
    member: [],
    invitation: [],
    guest: ["create", "read", "update"],
    offer: ["read", "redeem"],
    campaign: [],
    team: [],
    ac: ["read"],
  }),
} satisfies Record<HotelRole, unknown>
