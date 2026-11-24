import { expect, test } from "@playwright/test"
import { expectLocaleLayout, LOCALES, webUrl } from "../fixtures"

for (const locale of LOCALES) {
  test(`landing page in ${locale}`, async ({ page }) => {
    const response = await page.goto(webUrl(locale))
    expect(response?.status()).toBe(200)
    await expectLocaleLayout(page, locale)
  })
}
