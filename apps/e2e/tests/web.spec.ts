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

test("the cookie card floats above the bottom edge", async ({ page }) => {
  await page.goto(webUrl("ar"))
  const card = await page.getByRole("region", { name: "ملفات تعريف الارتباط التحليلية" }).boundingBox()
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 }
  expect(card?.x).toBeGreaterThan(0)
  expect(card && card.x + card.width).toBeLessThan(width)
  expect(card && card.y).toBeGreaterThan(height / 2)
  expect(card && card.y + card.height).toBeLessThan(height)
})

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
  // The api drops forms sent within seconds of being rendered, as bots do: age the stamp instead of waiting.
  await page.locator("input[name=renderedAt]").evaluate((input: HTMLInputElement) => {
    input.value = String(Number(input.value) - 60_000)
  })
  await page.getByRole("button", { name: "Join" }).click()
  await expect(page.getByRole("status").getByRole("heading", { name: "You are in, Amira" })).toBeVisible()
})

test("a hotel requests a demo from the landing page", async ({ page }) => {
  await page.goto(webUrl("en"))
  await page.getByLabel("Your name").fill("Sami Trabelsi")
  await page.getByLabel("Hotel name").fill("Hotel Test")
  await page.locator("#demo-phone").fill("98 123 456")
  await page.getByLabel("City").fill("Hammamet")
  await page.locator("form").getByRole("button", { name: "Request a demo" }).click()
  await expect(page.getByRole("status").getByText("Thank you, Sami")).toBeVisible()
})
