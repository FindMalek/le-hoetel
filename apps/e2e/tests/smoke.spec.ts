import { expect, test } from "@playwright/test"
import { DEFAULT_DEMO_PASSWORD, DEMO_SUPER_ADMIN_EMAIL, demoOwnerEmail } from "@ritorno/common/demo"
import { URLS } from "../env"

const PASSWORD = "correct horse battery"

test("the landing page renders its hero", async ({ page }) => {
  const response = await page.goto(URLS.web)
  expect(response?.status()).toBe(200)
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("main").getByRole("link", { name: "Request a demo" }).first()).toBeVisible()
})

test("both apps reach the api through /api/health", async ({ request }) => {
  for (const origin of [URLS.web, URLS.dashboard]) {
    const response = await request.get(`${origin}/api/health`)
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, db: true, env: "e2e" })
  }
})

test("an invited owner signs up, signs out, signs in, then asks for a password reset", async ({ page, request }) => {
  const run = Date.now()
  const email = `e2e-${run}@example.com`
  const admin = await request.post(`${URLS.api}/auth/sign-in/email`, {
    headers: { origin: URLS.dashboard },
    data: { email: DEMO_SUPER_ADMIN_EMAIL, password: DEFAULT_DEMO_PASSWORD },
  })
  expect(admin.status()).toBe(200)
  const invited = await request.post(`${URLS.api}/v1/admin/hotels`, {
    headers: { "x-csrf-token": "orpc" },
    data: { name: `E2E ${run}`, slug: `e2e-${run}`, ownerEmail: email },
  })
  expect(invited.status()).toBe(200)
  const hotel = await request.get(`${URLS.api}/v1/admin/hotels/${(await invited.json()).id}`, {
    headers: { "x-csrf-token": "orpc" },
  })
  const invitationId: string = (await hotel.json()).invitations[0].id

  await page.goto(`${URLS.dashboard}/sign-up?next=/accept-invitation/${invitationId}`)
  await page.getByLabel("Your name").fill("E2E")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await page.getByRole("button", { name: "Accept invitation" }).click()
  await expect(page.getByRole("heading", { name: "Hello E2E" })).toBeVisible()

  await page.getByRole("button", { name: "Account" }).click()
  await page.getByRole("menuitem", { name: "Sign out" }).click()
  await expect(page).toHaveURL(/\/sign-in$/)

  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByRole("heading", { name: "Hello E2E" })).toBeVisible()

  await page.context().clearCookies()
  await page.goto(`${URLS.dashboard}/forgot-password`)
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: "Send reset link" }).click()
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible()
})

test("the seeded demo owner and super admin can sign in", async ({ request }) => {
  for (const email of [demoOwnerEmail("dar-zitouna"), DEMO_SUPER_ADMIN_EMAIL]) {
    const response = await request.post(`${URLS.api}/auth/sign-in/email`, {
      headers: { origin: URLS.dashboard },
      data: { email, password: DEFAULT_DEMO_PASSWORD },
    })
    expect(response.status()).toBe(200)
  }
})
