import { expect, test } from "@playwright/test"
import { DEFAULT_DEMO_PASSWORD, demoOwnerEmail } from "@ritorno/common/demo"
import { URLS } from "../env"
import { expectLocaleLayout, LOCALES } from "../fixtures"

for (const locale of LOCALES) {
  test(`sign-in page in ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: URLS.dashboard }])
    await page.goto(`${URLS.dashboard}/sign-in`)
    await expectLocaleLayout(page, locale)
  })
}

// The api allows 10 sign-in posts a minute per ip, so only the hardest case signs in on every profile.
test("demo owner signs in, in Arabic", async ({ page, context }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "ar", url: URLS.dashboard }])
  await page.goto(`${URLS.dashboard}/sign-in`)
  await page.locator("input[type=email]").fill(demoOwnerEmail("dar-zitouna"))
  await page.locator("input[type=password]").fill(DEFAULT_DEMO_PASSWORD)
  await page.locator("button[type=submit]").click()
  await expect(page).not.toHaveURL(/sign-in/)
  await expectLocaleLayout(page, "ar")
})
