import { createHash } from "node:crypto"
import { appendFileSync } from "node:fs"
import { parseDotenv, pullSecrets, pushSecret } from "./secrets-lib.mjs"

// Before deploys read Infisical: per stack, which keys Infisical would change in the live Dokploy env. Names only,
// values are compared as sha256 and never printed. Keys deploy.mjs computes are skipped, they win over both anyway.
// With COPY_TO_INFISICAL=true, keys only Dokploy holds are copied into Infisical, so Infisical becomes the full source.
const env = process.env
const COMPUTED = new Set([
  "DEPLOY_ENV",
  "WEB_URL",
  "DASHBOARD_URL",
  "API_PUBLIC_URL",
  "DOCS_URL",
  "SEED",
  "MESSAGING_LIVE",
  "ALLOW_PREVIEW_ORIGINS",
  "S3_PREFIX",
  "GIT_SHA",
  "API_URL",
])
const STACKS = [
  { name: "staging", environment: "staging", composeId: env.DOKPLOY_STAGING_COMPOSE_ID },
  { name: "production", environment: "prod", composeId: env.DOKPLOY_PRODUCTION_COMPOSE_ID },
]
const hash = (value) => createHash("sha256").update(String(value)).digest("hex")
const SKIP = /^TELEGRAM_/
const list = (keys) => (keys.length ? keys.map((k) => `\`${k}\``).join(", ") : "none")

async function dokployEnv(composeId) {
  const base = env.DOKPLOY_URL.replace(/\/+$/, "")
  const res = await fetch(`${base}/api/compose.one?${new URLSearchParams({ composeId })}`, {
    headers: { "x-api-key": env.DOKPLOY_TOKEN },
  })
  if (!res.ok) throw new Error(`dokploy compose.one failed (${res.status})`)
  return parseDotenv((await res.json()).env)
}

let differAny = false
const lines = []
for (const stack of STACKS) {
  const live = await dokployEnv(stack.composeId)
  const infisical = await pullSecrets(stack.environment)
  const keys = Object.keys(infisical)
    .filter((k) => !COMPUTED.has(k))
    .sort()
  const shared = keys.filter((k) => k in live)
  const differ = shared.filter((k) => hash(live[k]) !== hash(infisical[k]))
  const dokployOnly = Object.keys(live)
    .filter((k) => !COMPUTED.has(k) && !SKIP.test(k) && live[k] !== "" && !(k in infisical))
    .sort()
  if (env.COPY_TO_INFISICAL === "true") for (const k of dokployOnly) await pushSecret(stack.environment, k, live[k])
  if (differ.length) differAny = true
  lines.push(
    `#### ${stack.name}`,
    `- differ (Infisical would overwrite): ${list(differ)}`,
    `- match: ${list(shared.filter((k) => !differ.includes(k)))}`,
    `- only in Infisical (would be added): ${list(keys.filter((k) => !(k in live)))}`,
    `- only in Dokploy${env.COPY_TO_INFISICAL === "true" ? " (copied to Infisical)" : ""}: ${list(dokployOnly)}`,
    "",
  )
}
const report = `### Dokploy vs Infisical\n\n${lines.join("\n")}`
console.log(report)
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, report)
process.exit(differAny ? 1 : 0)
