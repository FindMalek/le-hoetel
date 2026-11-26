import { expect, type Page, test } from "@playwright/test"
import { DEFAULT_DEMO_PASSWORD, DEMO_SUPER_ADMIN_EMAIL, demoOwnerEmail } from "@ritorno/common/demo"
import postgres from "postgres"
import { e2eDatabaseUrl, URLS } from "../env"

/** The demo seeds nobody with two hotels, so these memberships are added here and taken back after. */
const MEMBERS = [
  { id: "e2e-switch-owner", hotel: "demo-hotel-sunset-bay", email: demoOwnerEmail("dar-zitouna") },
  // Its own user: the api caps calls per user and minute, and the sweeps use up the first one's.
  { id: "e2e-switch-tabs", hotel: "demo-hotel-sunset-bay", email: demoOwnerEmail("villa-mimosa") },
  { id: "e2e-switch-admin", hotel: "demo-hotel-dar-zitouna", email: DEMO_SUPER_ADMIN_EMAIL },
]

/** Every page whose content belongs to one hotel. */
const PAGES = [
  "/",
  "/guests",
  "/redeem",
  "/offers",
  "/campaigns",
  "/messages",
  "/feedback",
  "/qr-codes",
  "/hotel",
  "/team",
  "/activity",
  "/metrics",
  "/emails",
  "/holidays",
  "/usage",
  "/data",
]

let db: postgres.Sql

test.beforeAll(async () => {
  db = postgres(e2eDatabaseUrl(), { max: 1, onnotice: () => {} })
  for (const { id, hotel, email } of MEMBERS) {
    await db`
      insert into member (id, organization_id, user_id, role, created_at)
      select ${id}, ${hotel}, id, 'owner', now() from "user" where email = ${email}`
  }
})

test.afterAll(async () => {
  await db`delete from member where id in ${db(MEMBERS.map((row) => row.id))}`
  await db.end()
})

async function open(page: Page, path: string) {
  await page.goto(`${URLS.dashboard}${path}`, { waitUntil: "networkidle" })
}

async function signIn(page: Page, email: string) {
  await open(page, "/sign-in")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(DEFAULT_DEMO_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).not.toHaveURL(/sign-in/)
}

async function pick(page: Page, hotel: string) {
  await page.getByRole("button", { name: "Switch hotel" }).click()
  await page.getByRole("menuitem", { name: hotel }).click()
}

const onScreen = (page: Page, hotel: string) =>
  expect(page.locator('[data-sidebar="header"]').getByText(hotel)).toBeVisible()

/** The text of every page, checking each is under the hotel's name and never names the other one. */
async function sweep(page: Page, hotel: string, other: string): Promise<Record<string, string>> {
  const texts: Record<string, string> = {}
  for (const path of PAGES) {
    await open(page, path)
    await onScreen(page, hotel)
    await expect(page.locator("#main"), path).not.toContainText(other)
    texts[path] = await page.locator("#main > div").last().innerText()
  }
  await open(page, "/team")
  return texts
}

test("a member of two hotels switches and every page follows", async ({ page }) => {
  test.slow()
  await signIn(page, demoOwnerEmail("dar-zitouna"))
  await onScreen(page, "Dar Zitouna")
  const before = await sweep(page, "Dar Zitouna", "Sunset Bay")
  await expect(page.locator("#main")).toContainText("manager.dar-zitouna@")

  await open(page, "/")
  await pick(page, "Sunset Bay Resort")
  await onScreen(page, "Sunset Bay Resort")
  const after = await sweep(page, "Sunset Bay Resort", "Zitouna")
  await expect(page.locator("#main")).toContainText("manager.sunset-bay@")
  for (const path of PAGES) expect(after[path], path).not.toBe(before[path])

  // A phone has no sidebar: the same switcher sits in the menu.
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, "/")
  await page.getByRole("button", { name: "More" }).click()
  await pick(page, "Dar Zitouna")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.locator("#main")).toContainText("how Dar Zitouna is doing")
})

test("the app admin changes hotel from the Hotels page and the switcher", async ({ page }) => {
  test.slow()
  const openAs = async (hotel: string) => {
    await open(page, "/admin/hotels")
    await page.getByRole("searchbox").fill(hotel)
    await page.getByRole("link", { name: new RegExp(hotel) }).click()
    await page.getByRole("button", { name: "Open as this hotel" }).click()
    await onScreen(page, hotel)
  }
  await signIn(page, DEMO_SUPER_ADMIN_EMAIL)
  await openAs("Dar Zitouna")
  await openAs("Villa Mimosa")

  // Acting as a hotel they are no member of: its data, never the team of their own one.
  await open(page, "/data")
  await expect(page.locator("#main")).not.toContainText("Not available for your role")
  await open(page, "/team")
  await expect(page.locator("#main")).toContainText("You are not a member of Villa Mimosa")

  // Picking their own hotel in the switcher ends the view.
  await open(page, "/")
  await pick(page, "Dar Zitouna")
  await onScreen(page, "Dar Zitouna")
  await expect(page.locator("[data-viewing-banner]")).toHaveCount(0)
})

test("a tab left on the old hotel is refused instead of acting on the new one", async ({ page, context }) => {
  await signIn(page, demoOwnerEmail("villa-mimosa"))
  await open(page, "/redeem")

  const second = await context.newPage()
  await open(second, "/")
  // Wherever the session is, the second tab moves it off the first one's hotel.
  await pick(second, "Sunset Bay Resort")
  await onScreen(second, "Sunset Bay Resort")

  await page.getByPlaceholder("AB3D-EF7H").fill("AB3D-EF7H")
  const answer = page.waitForResponse(/\/api\/rpc\/offers\/lookup/)
  await page.getByRole("button", { name: "Check" }).click()
  expect((await answer).status()).toBe(403)
})
