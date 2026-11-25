import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { URLS } from "../env"
import { LOCALES, webUrl } from "../fixtures"

const BLOCKING = ["serious", "critical"]

for (const locale of LOCALES.filter((l) => l !== "fr")) {
  const pages = [
    { name: "landing", url: () => webUrl(locale) },
    { name: "QR capture", url: () => `${URLS.web}/h/dar-zitouna?lang=${locale}` },
    { name: "sign-in", url: () => `${URLS.dashboard}/sign-in`, cookie: true },
  ]
  for (const { name, url, cookie } of pages) {
    test(`${name} page in ${locale} has no serious accessibility violations`, async ({ page, context }) => {
      if (cookie) await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: URLS.dashboard }])
      await page.goto(url())
      await page.waitForLoadState("networkidle")
      const { violations } = await new AxeBuilder({ page }).analyze()
      const blocking = violations
        .filter((v) => BLOCKING.includes(v.impact ?? ""))
        .map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes
            .slice(0, 3)
            .map((n) => `${n.target.join(" ")} ${n.html.slice(0, 140)} ${n.any[0]?.message ?? ""}`),
        }))
      expect(blocking).toEqual([])
    })
  }
}
