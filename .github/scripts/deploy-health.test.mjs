import assert from "node:assert/strict"
import { test } from "node:test"
import { waitForHealthy } from "./deploy-health.mjs"

const urls = {
  api: "https://api.test",
  web: "https://web.test",
  dashboard: "https://app.test",
  docs: "https://docs.test",
}

test("healthy only when every app answers on the new commit", async () => {
  const answers = (overrides) => async (url) => {
    const { status = 200, sha = "new" } = overrides[new URL(url).host] ?? {}
    return new Response(JSON.stringify({ sha }), { status })
  }
  const check = (overrides) => waitForHealthy(urls, "new", { fetch: answers(overrides), timeoutMs: 0 })

  assert.deepEqual(await check({}), [])
  assert.deepEqual(await check({ "web.test": { status: 404 }, "docs.test": { sha: "old" } }), [
    "web (https://web.test/api/health): status 404, sha new",
    "docs (https://docs.test/api/health): status 200, sha old",
  ])
})
