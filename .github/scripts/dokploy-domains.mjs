import { appendFileSync } from "node:fs"

// Adds the Ritorno hosts to the staging or production compose service. Existing domains (the old hosts) stay until DNS
// has moved and they are removed by hand in Dokploy. Safe to re-run.
// Env: DOKPLOY_URL, DOKPLOY_TOKEN, TARGET=staging|production, DOKPLOY_<TARGET>_COMPOSE_ID, optional DEPLOY_DOMAIN.
const env = process.env
const target = env.TARGET
const upper = String(target).toUpperCase()
const composeId = env[`DOKPLOY_${upper}_COMPOSE_ID`]
const domain = env.DEPLOY_DOMAIN || "findmalek.engineer"
const summary = (text) => env.GITHUB_STEP_SUMMARY && appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`)

if (!["staging", "production"].includes(target)) throw new Error("TARGET must be staging or production")
if (!env.DOKPLOY_URL || !env.DOKPLOY_TOKEN || !composeId)
  throw new Error(`set DOKPLOY_URL, DOKPLOY_TOKEN and DOKPLOY_${upper}_COMPOSE_ID`)

const prefix = target === "production" ? "" : "staging-"
const hosts = {
  web: `${prefix}ritorno`,
  dashboard: `app-${prefix}ritorno`,
  api: `api-${prefix}ritorno`,
  docs: `docs-${prefix}ritorno`,
}
const ports = { web: 3000, dashboard: 3002, api: 3001, docs: 3003 }

const call = async (method, path, body) => {
  const url = `${env.DOKPLOY_URL.replace(/\/+$/, "")}/api/${path}${method === "GET" ? `?${new URLSearchParams(body)}` : ""}`
  const res = await fetch(url, {
    method,
    headers: { "x-api-key": env.DOKPLOY_TOKEN, "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

const have = new Set((await call("GET", "domain.byComposeId", { composeId })).map((d) => d.host))
for (const [service, name] of Object.entries(hosts)) {
  const host = `${name}.${domain}`
  if (have.has(host)) {
    summary(`${target}: \`${host}\` already attached`)
    continue
  }
  await call("POST", "domain.create", {
    host,
    port: ports[service],
    https: true,
    certificateType: "letsencrypt",
    composeId,
    serviceName: service,
    domainType: "compose",
  })
  summary(`${target}: added \`${host}\` to ${service}`)
}
