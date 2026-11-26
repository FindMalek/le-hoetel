import { randomBytes } from "node:crypto"
import { appendFileSync } from "node:fs"

// Creates (once) the Dokploy compose service of staging or production with its env and domains. Safe to re-run:
// an existing service keeps its env unless FORCE_ENV=1. Env: DOKPLOY_URL, DOKPLOY_TOKEN, TARGET, ENVIRONMENT_ID, optional SECRETS_OUT.
const { DOKPLOY_URL, DOKPLOY_TOKEN, TARGET, ENVIRONMENT_ID, SECRETS_OUT, FORCE_ENV } = process.env
const DOMAIN = process.env.DOMAIN ?? "findmalek.engineer"
const prod = TARGET === "production"
const hosts = prod
  ? { web: "ritorno", dashboard: "app-ritorno", api: "api-ritorno", docs: "docs-ritorno" }
  : {
      web: "staging-ritorno",
      dashboard: "app-staging-ritorno",
      api: "api-staging-ritorno",
      docs: "docs-staging-ritorno",
    }
for (const k of Object.keys(hosts)) hosts[k] = `${hosts[k]}.${DOMAIN}`

const call = async (method, path, body) => {
  const url = `${DOKPLOY_URL.replace(/\/+$/, "")}/api/${path}${method === "GET" ? `?${new URLSearchParams(body)}` : ""}`
  const res = await fetch(url, {
    method,
    headers: { "x-api-key": DOKPLOY_TOKEN, "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

const name = `ritorno-${TARGET}`
const projects = await call("GET", "project.all", {})
const existing = projects
  .flatMap((p) => p.environments)
  .find((e) => e.environmentId === ENVIRONMENT_ID)
  ?.compose?.find((c) => c.name === name)
const created = existing
  ? null
  : await call("POST", "compose.create", {
      name,
      appName: name,
      environmentId: ENVIRONMENT_ID,
      composeType: "docker-compose",
    })
const composeId = existing?.composeId ?? created.composeId

const secret = (n = 24) => randomBytes(n).toString("base64url")
const env = {
  DEPLOY_ENV: TARGET,
  WEB_URL: `https://${hosts.web}`,
  DASHBOARD_URL: `https://${hosts.dashboard}`,
  API_PUBLIC_URL: `https://${hosts.api}`,
  DOCS_URL: `https://${hosts.docs}`,
  POSTGRES_PASSWORD: secret(),
  BETTER_AUTH_SECRET: secret(32),
  ADMIN_EMAIL: "admin@ritorno.local",
  ADMIN_PASSWORD: secret(16),
  SEED: prod ? "none" : "demo",
  DEMO_PASSWORD: secret(16),
  DEMO_VIEWER_PASSWORD: prod ? "" : secret(16),
  MESSAGING_LIVE: prod ? "true" : "false",
  ALLOW_PREVIEW_ORIGINS: prod ? "false" : "true",
  S3_PREFIX: prod ? "" : "staging/",
  POSTGRES_USER: "ritorno",
  POSTGRES_DB: "ritorno",
}
if (!existing || FORCE_ENV) {
  await call("POST", "compose.update", {
    composeId,
    sourceType: "git",
    customGitUrl: "https://github.com/FindMalek/ritorno.git",
    customGitBranch: "main",
    composePath: "./docker-compose.deploy.yml",
    env: Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n"),
    autoDeploy: false,
  })
  if (SECRETS_OUT)
    appendFileSync(SECRETS_OUT, `${TARGET} ADMIN_EMAIL=${env.ADMIN_EMAIL} ADMIN_PASSWORD=${env.ADMIN_PASSWORD}\n`, {
      mode: 0o600,
    })
}

const have = new Set((await call("GET", "domain.byComposeId", { composeId }).catch(() => [])).map((d) => d.host))
const ports = { web: 3000, dashboard: 3002, api: 3001, docs: 3003 }
for (const [service, h] of Object.entries(hosts)) {
  if (have.has(h)) continue
  await call("POST", "domain.create", {
    host: h,
    port: ports[service],
    https: true,
    certificateType: "letsencrypt",
    composeId,
    serviceName: service,
    domainType: "compose",
  })
}
console.log(composeId)
