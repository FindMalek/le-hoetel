import { expect, test } from "bun:test"
import { hotelHealth } from "./hotel"

const now = new Date("2026-06-30T12:00:00Z")
const base = {
  status: "active",
  ownerCount: 1,
  guestCount: 5,
  lastGuestAt: new Date("2026-06-29T12:00:00Z"),
  now,
} as const

test("hotel health reports the first problem, quiet after two weeks without a guest", () => {
  expect(hotelHealth(base)).toBe("healthy")
  expect(hotelHealth({ ...base, lastGuestAt: new Date("2026-06-10T12:00:00Z") })).toBe("quiet")
  expect(hotelHealth({ ...base, guestCount: 0, lastGuestAt: null })).toBe("no-guests")
  expect(hotelHealth({ ...base, ownerCount: 0, guestCount: 0, lastGuestAt: null })).toBe("no-owner")
  expect(hotelHealth({ ...base, status: "suspended", ownerCount: 0 })).toBe("suspended")
})
