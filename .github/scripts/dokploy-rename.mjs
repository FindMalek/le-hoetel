import { appendFileSync } from "node:fs"

// Renames the Dokploy project and the staging and production compose services to Ritorno. Only the display `name`
// changes: `appName` stays, container and volume names derive from it and the postgres volume would be orphaned.
// Safe to re-run. Env: DOKPLOY_URL, DOKPLOY_TOKEN, DOKPLOY_STAGING_COMPOSE_ID, DOKPLOY_PRODUCTION_COMPOSE_ID.
const env = process.env
const summary = (text) => env.GITHUB_STEP_SUMMARY && appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`)
if (!env.DOKPLOY_URL || !env.DOKPLOY_TOKEN) throw new Error("set DOKPLOY_URL and DOKPLOY_TOKEN")

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

const projectIds = new Set()
for (const target of ["staging", "production"]) {
  const composeId = env[`DOKPLOY_${target.toUpperCase()}_COMPOSE_ID`]
  if (!composeId) continue
  const compose = await call("GET", "compose.one", { composeId })
  const projectId = compose.environment?.projectId ?? compose.projectId ?? compose.project?.projectId
  if (projectId) projectIds.add(projectId)
  const name = `ritorno-${target}`
  if (compose.name !== name) await call("POST", "compose.update", { composeId, name })
  summary(`${target} compose: \`${compose.name}\` -> \`${name}\` (appName \`${compose.appName}\` kept)`)
}

for (const projectId of projectIds) {
  const project = await call("GET", "project.one", { projectId })
  if (project.name !== "Ritorno") await call("POST", "project.update", { projectId, name: "Ritorno" })
  summary(`project: \`${project.name}\` -> \`Ritorno\``)
}
