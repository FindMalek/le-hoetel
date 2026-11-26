import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import type { Case } from "../../../packages/notification/src/tests/matrix"

// Layout checks on a phone instead of pixel baselines: system and Arabic fonts differ from machine to machine.
const MATRIX = fileURLToPath(new URL("../../../packages/notification/src/tests/matrix.ts", import.meta.url))
const emails: Case[] = JSON.parse(execFileSync("bun", [MATRIX], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }))
const WIDTH = 375

test.use({ viewport: { width: WIDTH, height: 700 } })

for (const colorScheme of ["light", "dark"] as const) {
  for (const { name, locale, kind, html } of emails) {
    test(`${kind} ${name} in ${locale} reads well on a phone (${colorScheme})`, async ({ page }, testInfo) => {
      await page.route(/^https?:/, (route) => route.abort())
      await page.emulateMedia({ colorScheme })
      await page.setContent(html)

      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(WIDTH)
      await expect(page.locator("html")).toHaveCSS("direction", locale === "ar" ? "rtl" : "ltr")

      // Every button is a full touch target.
      for (const button of await page.locator("td > a").all()) {
        expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      }

      if (kind === "hotel") {
        await expect(page.locator("h1")).toHaveCSS("text-align", locale === "ar" ? "right" : "left")
        const unsubscribe = page.locator('a[href*="/u/"]')
        await unsubscribe.scrollIntoViewIfNeeded()
        await expect(unsubscribe).toBeInViewport({ ratio: 1 })
      }

      // Catches a missing dark mode class or a brand color nobody can read.
      const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast", "image-alt"]).analyze()
      expect(violations.flatMap((violation) => violation.nodes.map((node) => node.html))).toEqual([])

      await testInfo.attach(`${kind}-${name}-${locale}-${colorScheme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      })
    })
  }
}
