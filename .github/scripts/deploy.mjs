import { appendFileSync } from "node:fs"

// TARGET=staging|production, REF = branch or tag to build (default: main for staging, required for production).
const env = process.env
const target = env.TARGET
const summary = (text) => env.GITHUB_STEP_SUMMARY && appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`)
const upper = String(target).toUpperCase()
const composeId = env[`DOKPLOY_${upper}_COMPOSE_ID`]
const apiUrl = env[`${upper}_API_URL`]
const ref = env.REF || (target === "staging" ? "main" : "")

if (!["staging", "production"].includes(target)) throw new Error("TARGET must be staging or production")
if (!env.DOKPLOY_URL || !env.DOKPLOY_TOKEN || !composeId) {
  summary(`${target} deploy skipped: set DOKPLOY_URL, DOKPLOY_${upper}_COMPOSE_ID and the DOKPLOY_TOKEN secret`)
  console.log("skipped, missing config")
  process.exit(0)
}
if (!ref) throw new Error("REF is required for production")

const base = env.DOKPLOY_URL.replace(/\/+$/, "")
async function dokploy(path, body) {
  const res = await fetch(`${base}/api/${path}`, {
    method: "POST",
    headers: { "x-api-key": env.DOKPLOY_TOKEN, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`dokploy ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
}

await dokploy("compose.update", { composeId, customGitBranch: ref })
await dokploy("compose.deploy", { composeId, title: `${target} ${ref}` })
summary(`${target} deploy started for \`${ref}\``)

if (!apiUrl) process.exit(0)
for (let i = 0; i < 60; i++) {
  const ok = await fetch(`${apiUrl.replace(/\/+$/, "")}/health`).then(
    (r) => r.ok,
    () => false,
  )
  if (ok) {
    summary(`${target} api healthy`)
    process.exit(0)
  }
  await new Promise((r) => setTimeout(r, 20_000))
}
summary(`${target} api not healthy after 20 minutes`)
process.exit(1)
