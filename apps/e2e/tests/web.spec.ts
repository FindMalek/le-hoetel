import { expect, test } from "@playwright/test"
import { URLS } from "../env"
import { expectLocaleLayout, LOCALES, webUrl } from "../fixtures"

for (const locale of LOCALES) {
  test(`landing page in ${locale}`, async ({ page }) => {
    const response = await page.goto(webUrl(locale))
    expect(response?.status()).toBe(200)
    await expectLocaleLayout(page, locale)
  })
}

for (const locale of LOCALES) {
  test(`QR capture page in ${locale} fits the screen`, async ({ page }) => {
    await page.goto(`${URLS.web}/h/dar-zitouna?lang=${locale}`)
    await expect(page.locator("div[lang]").first()).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr")
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test("a guest signs up from the QR page and sees the welcome at once", async ({ page }) => {
  await page.goto(`${URLS.web}/h/dar-zitouna?lang=en&src=room&loc=e2e`)
  await page.getByLabel("Your name").fill("Amira Ben Salah")
  await page.locator("#capture-phone").fill("98 765 432")
  await page.waitForTimeout(3100)
  await page.getByRole("button", { name: "Join" }).click()
  await expect(page.getByRole("status").getByRole("heading", { name: "You are in, Amira" })).toBeVisible()
})
