import { afterEach, expect, test } from "bun:test"
import { isIndexable, websiteJsonLd } from "./seo"

const before = { ...process.env }
afterEach(() => {
  process.env = { ...before }
})

test("only a real, non preview origin is indexable", () => {
  process.env.WEB_URL = "https://ritorno.com/"
  process.env.DEPLOY_ENV = "production"
  expect(isIndexable()).toBe(true)

  process.env.DEPLOY_ENV = "pr-12"
  expect(isIndexable()).toBe(false)

  process.env.DEPLOY_ENV = "production"
  process.env.WEB_URL = "http://localhost:3000"
  expect(isIndexable()).toBe(false)
})

test("robots blocks guest pages and the schema lists the product", async () => {
  process.env.WEB_URL = "https://ritorno.com"
  process.env.DEPLOY_ENV = "production"
  const rules = (await import("../app/robots")).default().rules
  expect(rules).toMatchObject({ disallow: expect.arrayContaining(["/h/", "/s/", "/u/", "/o/"]) })
  const types = websiteJsonLd()["@graph"].map((node) => node["@type"])
  expect(types).toEqual(["WebSite", "Organization", "SoftwareApplication"])
})
