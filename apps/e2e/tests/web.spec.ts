import { expect, test } from "@playwright/test"
import postgres from "postgres"
import { e2eDatabaseUrl, URLS } from "../env"
import { expectLocaleLayout, LOCALES, webUrl } from "../fixtures"

for (const locale of LOCALES) {
  test(`landing page in ${locale}`, async ({ page }) => {
    const response = await page.goto(webUrl(locale))
    expect(response?.status()).toBe(200)
    await expectLocaleLayout(page, locale)
  })
}

for (const locale of LOCALES) {
  test(`roadmap page in ${locale} links back to the landing and the dashboard`, async ({ page }) => {
    const prefix = locale === "en" ? "" : `/${locale}`
    expect((await page.goto(`${URLS.web}${prefix}/roadmap`))?.status()).toBe(200)
    await expectLocaleLayout(page, locale)
    await expect(page.locator(`[data-slot=pill-nav] a[href="${prefix || "/"}#how"]`)).toHaveCount(1)
    await expect(page.locator(`[data-slot=pill-nav] a[href^="${URLS.dashboard}"]`)).toHaveCount(1)
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
  await page.getByRole("button", { name: "Join" }).click()
  await expect(page.getByRole("status").getByRole("heading", { name: "You are in, Amira" })).toBeVisible()
})

test("consent is off and above Join, and the email field opens under its toggle", async ({ page }) => {
  await page.goto(`${URLS.web}/h/dar-zitouna?lang=en`)
  const consent = page.locator("input[name=emailConsent]")
  await expect(consent).not.toBeChecked()
  await expect(page.locator("input[name=whatsapp]")).not.toBeChecked()
  await expect(page.locator("#capture-email")).toHaveCount(0)

  const join = page.getByRole("button", { name: "Join" })
  const top = async (locator: typeof join) => (await locator.boundingBox())?.y ?? 0
  expect(await top(join)).toBeGreaterThan(await top(page.locator("label").filter({ has: consent })))
  await expect(join).not.toBeInViewport({ ratio: 1 })

  await consent.check({ force: true })
  const email = page.locator("#capture-email")
  expect(await top(email)).toBeGreaterThan(await top(page.locator("label").filter({ has: consent })))
  expect(await top(email)).toBeLessThan(await top(join))
})

test.describe("on a French phone", () => {
  test.use({ locale: "fr-FR" })

  test("the capture page reads French, and `?lang` still wins", async ({ page }) => {
    await page.goto(`${URLS.web}/h/dar-zitouna`)
    await expect(page.getByRole("button", { name: "Rejoindre" })).toBeVisible()
    await expect(page.locator("input[name=language]")).toHaveValue("fr")
    await page.goto(`${URLS.web}/h/dar-zitouna?lang=en`)
    await expect(page.getByRole("button", { name: "Join" })).toBeVisible()
  })
})

test.describe("on a German phone", () => {
  test.use({ locale: "de-DE" })

  test("a local number is stored as Tunisian", async ({ page }) => {
    await page.goto(`${URLS.web}/h/dar-zitouna?lang=en`)
    await page.getByLabel("Your name").fill("Locale Check")
    await page.locator("#capture-phone").fill("20 765 421")
    await page.getByRole("button", { name: "Join" }).click()
    await expect(page.getByRole("heading", { name: "You are in, Locale" })).toBeVisible()

    const sql = postgres(e2eDatabaseUrl(), { max: 1 })
    const rows = await sql`select phone_e164 from guests where name = 'Locale Check'`
    await sql.end()
    expect(rows.map((row) => row.phone_e164)).toEqual(["+21620765421"])
  })
})

test("a sign-up that does not reach the server never says joined and can be retried", async ({ page, context }) => {
  await page.goto(`${URLS.web}/h/dar-zitouna?lang=en`)
  await page.getByLabel("Your name").fill("Yassine Gharbi")
  await page.locator("#capture-phone").fill("98 765 433")
  const joined = page.getByRole("heading", { name: "You are in, Yassine" })

  await context.setOffline(true)
  await page.getByRole("button", { name: "Join" }).click()
  await expect(page.getByRole("alert").filter({ hasText: "was not sent" })).toBeVisible()
  await expect(joined).toBeHidden()
  await expect(page.getByLabel("Your name")).toHaveValue("Yassine Gharbi")
  await expect(page.locator("#capture-phone")).toHaveValue("98 765 433")

  await context.setOffline(false)
  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/h/dar-zitouna**", async (route) => {
    if (route.request().method() === "POST") await held
    await route.continue()
  })
  await page.getByRole("button", { name: "Join" }).click()
  await expect(page.getByRole("button", { name: "Sending" })).toBeDisabled()
  await expect(joined).toBeHidden()
  release()
  await expect(joined).toBeVisible()
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

test("the hotel's try-out of the QR page cannot send anything", async ({ page }) => {
  await page.goto(`${URLS.web}/h/dar-zitouna?lang=en&src=room&loc=12&preview=1`)
  await expect(page.getByText("Nothing is saved or counted.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Join" })).toBeDisabled()
})
