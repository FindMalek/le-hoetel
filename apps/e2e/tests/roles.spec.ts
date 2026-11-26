import { expect, type Page, test } from "@playwright/test"
import { DEFAULT_DEMO_PASSWORD, DEMO_EMAIL_DOMAIN, DEMO_SUPER_ADMIN_EMAIL } from "@ritorno/common/demo"
import { URLS } from "../env"

const open = (page: Page, path: string) => page.goto(`${URLS.dashboard}${path}`, { waitUntil: "networkidle" })

async function signIn(page: Page, email: string) {
  await open(page, "/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(DEFAULT_DEMO_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).not.toHaveURL(/sign-in/)
}

test("staff see no manager pages and are refused when typing their address", async ({ page }) => {
  await signIn(page, `service.riad-dattier@${DEMO_EMAIL_DOMAIN}`)
  const menu = page.locator('[data-sidebar="content"]')
  await expect(menu.getByRole("link", { name: "Guests", exact: true })).toBeVisible()
  await expect(menu.getByRole("link", { name: "Campaigns" })).toHaveCount(0)

  await open(page, "/campaigns/new")
  await expect(page.locator("#main")).toContainText("Not available for your role")
  await expect(page.locator("#main form")).toHaveCount(0)

  await open(page, "/admin/hotels")
  await expect(page.locator("#main")).toContainText("This page does not exist")
})

test("with no hotel open the hotel menu is gone and a refused page says so", async ({ page }) => {
  await signIn(page, DEMO_SUPER_ADMIN_EMAIL)
  // The demo admin belongs to no hotel until they open one.
  await expect(page.locator('[data-sidebar="content"]').getByRole("link", { name: "Hotels" })).toBeVisible()
  await expect(page.locator('[data-sidebar="content"]').getByRole("link", { name: "Guests" })).toHaveCount(0)

  await open(page, "/offers")
  await expect(page.locator("#main")).toContainText("It is on our side")
})
