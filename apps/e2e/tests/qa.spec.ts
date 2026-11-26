import { expect, type Page, test } from "@playwright/test"
import { DEFAULT_DEMO_PASSWORD, DEMO_EMAIL_DOMAIN, demoOwnerEmail } from "@ritorno/common/demo"
import { URLS } from "../env"

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

async function signIn(page: Page, email: string, locale: string) {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: URLS.dashboard }])
  const res = await page.request.post(`${URLS.dashboard}/api/auth/sign-in/email`, {
    headers: { origin: URLS.dashboard },
    data: { email, password: DEFAULT_DEMO_PASSWORD },
  })
  expect(res.ok()).toBe(true)
}

test("on a phone the log shows first, and the cookie card leaves the form room", async ({ page }) => {
  await signIn(page, demoOwnerEmail("dar-zitouna"), "en")
  await page.goto(`${URLS.dashboard}/activity`)
  await expect(page.locator("#main input[name=from]")).toBeHidden()
  await page.locator("#main").getByRole("button", { name: "Filters" }).click()
  await expect(page.locator("#main input[name=from]")).toBeVisible()

  await page.goto(`${URLS.dashboard}/guests/new`)
  await expect(page.getByRole("region", { name: "Analytics cookies" })).toBeVisible()
  await expect(page.locator("#main [data-slot=sticky-form-actions]")).toHaveCSS("position", "static")

  await page.goto(`${URLS.dashboard}/emails`)
  const group = await page.locator("#main").getByRole("tablist").first().boundingBox()
  const last = await page.locator("#main").getByRole("tab", { name: "Offer reminder" }).boundingBox()
  expect(group && last && last.y + last.height <= group.y + group.height).toBe(true)
})

test("staff are told campaigns and holidays are not theirs", async ({ page }) => {
  await signIn(page, `reception.dar-zitouna@${DEMO_EMAIL_DOMAIN}`, "en")
  for (const path of ["campaigns", "holidays"]) {
    await page.goto(`${URLS.dashboard}/${path}`)
    await expect(page.locator("#main").getByText("Not available for your role")).toBeVisible()
  }
})

test("platform stat titles are whole in French", async ({ page }) => {
  await signIn(page, `admin@${DEMO_EMAIL_DOMAIN}`, "fr")
  await page.goto(`${URLS.dashboard}/admin/overview`)
  for (const title of ["Taux de consentement", "Crédit WhatsApp bas"]) {
    const label = page.locator("#main").getByText(title, { exact: true }).first()
    expect(await label.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
  }
})
