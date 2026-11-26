import { expect, test } from "bun:test"
import type { HotelRole } from "@ritorno/common/hotel"
import { activeHref, navFor, visibleNav } from "../nav"

const hrefs = (role: HotelRole | null, admin = false): string[] => visibleNav({ role, admin }).map((item) => item.href)
const MANAGER_ONLY = ["/guests/import", "/campaigns", "/holidays", "/hotel", "/data", "/activity", "/usage"]

test("staff get the front desk pages, managers and owners the rest too", () => {
  const staff = hrefs("staff")
  expect(staff).toEqual(expect.arrayContaining(["/guests", "/redeem", "/offers", "/team", "/settings"]))
  for (const href of MANAGER_ONLY) expect(staff).not.toContain(href)
  for (const role of ["manager", "owner"] as const) {
    expect(hrefs(role)).toEqual(expect.arrayContaining(MANAGER_ONLY))
    expect(hrefs(role)).not.toContain("/users")
  }
})

test("with no hotel on screen only account pages stay, plus the platform ones for the admin", () => {
  expect(hrefs(null)).toEqual(["/", "/inbox", "/settings"])
  expect(hrefs(null, true)).toEqual(expect.arrayContaining(["/admin/hotels", "/users", "/audit-log", "/", "/settings"]))
  expect(hrefs(null, true)).not.toContain("/guests")
})

test("a nested page keeps its section active, home only matches itself", () => {
  expect(activeHref(["/"], "/team")).toBeUndefined()
  expect(activeHref(["/data"], "/database")).toBeUndefined()
  expect(navFor("/admin/hotels/abc")?.label).toBe("hotels")
})

test("the deepest entry wins, so import does not also light guests", () => {
  expect(navFor("/guests/import")?.label).toBe("import")
  expect(navFor("/guests/abc")?.label).toBe("guests")
})
