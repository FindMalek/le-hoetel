import { expect, test } from "bun:test"
import { isActive, navFor, visibleNav } from "./nav"

test("admin pages only show for admins", () => {
  const hrefs = (role: string | null) => visibleNav(role).map((item) => item.href)
  expect(hrefs(null)).not.toContain("/users")
  expect(hrefs("admin")).toContain("/users")
})

test("a nested page keeps its section active, home only matches itself", () => {
  expect(isActive("/", "/team")).toBe(false)
  expect(isActive("/admin/hotels", "/admin/hotels/abc")).toBe(true)
  expect(isActive("/data", "/database")).toBe(false)
  expect(navFor("/admin/hotels")?.label).toBe("hotels")
})
