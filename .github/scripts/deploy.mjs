import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { waitForHealthy } from "./deploy-health.mjs"
import { formatDotenv, infisicalConfigured, parseDotenv, pullSecrets } from "./secrets-lib.mjs"

// TARGET=staging|production, REF = branch or tag to build (default: main for staging, required for production).
const env = process.env
const target = env.TARGET
const summary = (text) => env.GITHUB_STEP_SUMMARY && appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`)
const upper = String(target).toUpperCase()
const composeId = env[`DOKPLOY_${upper}_COMPOSE_ID`]
const ref = env.REF || (target === "staging" ? "main" : "")

if (!["staging", "production"].includes(target)) throw new Error("TARGET must be staging or production")
if (!env.DOKPLOY_URL || !env.DOKPLOY_TOKEN || !composeId) {
  summary(`${target} deploy skipped: set DOKPLOY_URL, DOKPLOY_${upper}_COMPOSE_ID and the DOKPLOY_TOKEN secret`)
  console.log("skipped, missing config")
  process.exit(0)
}
if (!ref) throw new Error("REF is required for production")

// The commit Dokploy will build for `ref`, so the wait below can tell the new apps from the old ones.
async function resolveSha(ref) {
  if (env.GITHUB_REPOSITORY) {
    const res = await fetch(
      `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/commits/${encodeURIComponent(ref)}`,
      {
        headers: {
          accept: "application/vnd.github.sha",
          ...(env.GITHUB_TOKEN && { authorization: `Bearer ${env.GITHUB_TOKEN}` }),
        },
      },
    )
    if (!res.ok) throw new Error(`could not resolve ${ref} to a commit (${res.status})`)
    return (await res.text()).trim()
  }
  return execFileSync("git", ["rev-parse", `${ref}^{commit}`], { encoding: "utf8" }).trim()
}
const sha = await resolveSha(ref)

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
  ? { web: "ritorno", dashboard: "app-ritorno", api: "api-ritorno", docs: "docs-ritorno" }
  : {
      web: "staging-ritorno",
      dashboard: "app-staging-ritorno",
      api: "api-staging-ritorno",
      docs: "docs-staging-ritorno",
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
  GIT_SHA: sha,
}

// The staging and production volumes were created before the rename and hold this role and database. Used only when
// the env sets neither key, until a dump and restore moves them (see the deploy-runbook docs page).
const legacyDb = { POSTGRES_USER: "le_hoetel", POSTGRES_DB: "le_hoetel" }

// Infisical wins over what Dokploy already holds, computed values win over both. Without INFISICAL_* the Dokploy env
// is kept and only the computed values are refreshed.
const compose = await dokploy("compose.one", { composeId }, "GET")
const current = parseDotenv(compose.env)
// Dokploy puts every service with a domain on the shared dokploy-network, where staging's and production's `api` both
// answer the name `api`. The container name (Dokploy runs compose with the appName as project) is unique per stack.
if (compose.appName) computed.API_URL = `http://${compose.appName}-api-1:3001`
else summary(`${target}: no appName from Dokploy, API_URL stays on the shared \`api\` name`)
let secrets = {}
if (infisicalConfigured(env)) {
  secrets = await pullSecrets(prod ? "prod" : "staging", env)
  summary(`${target} env from infisical (${Object.keys(secrets).length} keys)`)
}
const update = {
  composeId,
  customGitBranch: ref,
  env: formatDotenv({ ...legacyDb, ...current, ...secrets, ...computed }),
}
await dokploy("compose.update", update)
await dokploy("compose.deploy", { composeId, title: `${target} ${ref}` })
summary(`${target} deploy started for \`${ref}\` (${sha.slice(0, 7)})`)

const urls = {
  api: env[`${upper}_API_URL`] || url("api"),
  web: url("web"),
  dashboard: url("dashboard"),
  docs: url("docs"),
}
const failing = await waitForHealthy(urls, sha)
if (failing.length > 0) {
  const report = `${target} not healthy on ${sha.slice(0, 7)} after 20 minutes\n${failing.map((f) => `- ${f}`).join("\n")}`
  summary(report)
  console.error(report)
  process.exit(1)
}
summary(`${target} api, web, dashboard and docs healthy on ${sha.slice(0, 7)}`)
// Only a deploy that proved the new sha live reports it, so a release can never tag an unverified commit.
if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `healthy-sha=${sha}\n`)
