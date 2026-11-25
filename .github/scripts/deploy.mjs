import { appendFileSync } from "node:fs"
import { formatDotenv, infisicalConfigured, parseDotenv, pullSecrets } from "./secrets-lib.mjs"

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
async function dokploy(path, body, method = "POST") {
  const res = await fetch(`${base}/api/${path}${method === "GET" ? `?${new URLSearchParams(body)}` : ""}`, {
    method,
    headers: { "x-api-key": env.DOKPLOY_TOKEN, "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`dokploy ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

const prod = target === "production"
const domain = env.DEPLOY_DOMAIN || "findmalek.engineer"
const hosts = prod
  ? { web: "lehoetel", dashboard: "app-lehoetel", api: "api-lehoetel", docs: "docs-lehoetel" }
  : {
      web: "staging-lehoetel",
      dashboard: "app-staging-lehoetel",
      api: "api-staging-lehoetel",
      docs: "docs-staging-lehoetel",
    }
const url = (app) => `https://${hosts[app]}.${domain}`
const computed = {
  DEPLOY_ENV: target,
  WEB_URL: url("web"),
  DASHBOARD_URL: url("dashboard"),
  API_PUBLIC_URL: url("api"),
  DOCS_URL: url("docs"),
  SEED: prod ? "none" : "demo",
  MESSAGING_LIVE: prod ? "true" : "false",
  ALLOW_PREVIEW_ORIGINS: prod ? "false" : "true",
  S3_PREFIX: prod ? "" : "staging/",
}

// Infisical wins over what Dokploy already holds, computed values win over both. Without INFISICAL_* the env is left alone.
const update = { composeId, customGitBranch: ref }
if (infisicalConfigured(env)) {
  const current = parseDotenv((await dokploy("compose.one", { composeId }, "GET")).env)
  const secrets = await pullSecrets(prod ? "prod" : "staging", env)
  update.env = formatDotenv({ ...current, ...secrets, ...computed })
  summary(`${target} env from infisical (${Object.keys(secrets).length} keys)`)
}
await dokploy("compose.update", update)
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
