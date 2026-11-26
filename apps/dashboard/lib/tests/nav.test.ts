import { expect, test } from "bun:test"
import { activeHref, navFor, visibleNav } from "../nav"

test("admin pages only show for admins", () => {
  const hrefs = (role: string | null) => visibleNav(role).map((item) => item.href)
  expect(hrefs(null)).not.toContain("/users")
  expect(hrefs("admin")).toContain("/users")
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
