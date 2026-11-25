import { createHash } from "node:crypto"

export const MARKER = "findplate-preview"

export const STATUS = {
  building: "Building",
  ready: "Ready",
  failed: "Failed",
  removed: "Removed",
  reused: "Staging",
}

const ICON = { building: "🟡", ready: "✅", failed: "❌", removed: "⚪", reused: "🔁" }

export function prAppName(pr, app) {
  return `pr-${pr}-${app}`
}

export function previewHost(pr, app, domain) {
  return `${prAppName(pr, app)}.${String(domain).replace(/^\.+|\.+$/g, "")}`
}

export function tail(text, lines = 25, maxChars = 1800) {
  const out = String(text ?? "")
    .trimEnd()
    .split("\n")
    .slice(-lines)
    .join("\n")
  return out.length > maxChars ? `...${out.slice(-maxChars)}` : out
}

export function parseStatePayload(body) {
  const m = new RegExp(`<!-- ${MARKER} (\\{.*?\\}) -->`, "s").exec(body ?? "")
  if (!m) return null
  try {
    return JSON.parse(m[1])
  } catch {
    return null
  }
}

export function utc(date) {
  return `${new Date(date).toISOString().slice(0, 16).replace("T", " ")} UTC`
}

export const STAGING_HOSTS = {
  web: "staging-lehoetel",
  dashboard: "app-staging-lehoetel",
  api: "api-staging-lehoetel",
  docs: "docs-staging-lehoetel",
}

export function stagingUrl(app, domain = "findmalek.engineer") {
  return `https://${STAGING_HOSTS[app]}.${domain}`
}

// Same password for every account of a preview, stable across pushes, derived so nothing has to be stored.
export function previewSecret(token, pr, label, length = 20) {
  return createHash("sha256").update(`${token}:${pr}:${label}`).digest("hex").slice(0, length)
}

export function previewDb(pr, token, host) {
  return { host, port: 5432, database: "lehoetel", user: "lehoetel", password: previewSecret(token, pr, "db", 24) }
}

// rows: [{ app, status, url, inspectUrl, updatedAt, error }], state: { app: applicationId, _db?: internal host }
// extra: { creds: { ownerEmail, adminEmail, password }, db, whodbUrl, tools: [{ name, url }], note }
export function renderComment({ pr, sha, rows, state = {}, extra = {} }) {
  const lines = [
    `<!-- ${MARKER} ${JSON.stringify(state)} -->`,
    `### Preview deployments for #${pr}`,
    "",
    "| App | Status | Preview | Inspect | Updated |",
    "| --- | --- | --- | --- | --- |",
  ]
  for (const r of rows) {
    const label = r.status === "reused" ? "Staging app" : "Visit preview"
    const preview = r.url && r.status !== "removed" ? `[${label}](${r.url})` : "-"
    const inspect = r.inspectUrl ? `[Inspect](${r.inspectUrl})` : "-"
    lines.push(
      `| **${r.app}** | ${ICON[r.status]} ${STATUS[r.status]} | ${preview} | ${inspect} | ${utc(r.updatedAt)} |`,
    )
  }
  if (extra.note) lines.push("", extra.note)
  if (extra.creds) {
    const c = extra.creds
    lines.push(
      "",
      "<details><summary>Demo logins (fake data, messaging is log only)</summary>",
      "",
      `- hotel owner: \`${c.ownerEmail}\` / \`${c.password}\``,
      `- super admin: \`${c.adminEmail}\` / \`${c.password}\``,
      "",
      "</details>",
    )
  }
  if (extra.db) {
    const d = extra.db
    lines.push(
      "",
      `<details><summary>Database (own postgres for this PR)</summary>`,
      "",
      `Open [WhoDB](${extra.whodbUrl}), pick Postgres and enter:`,
      "",
      `- host \`${d.host}\`, port \`${d.port}\``,
      `- database \`${d.database}\`, user \`${d.user}\`, password \`${d.password}\``,
      "",
      "</details>",
    )
  }
  if (extra.tools?.length) lines.push("", extra.tools.map((t) => `[${t.name}](${t.url})`).join(" · "))
  for (const r of rows.filter((x) => x.status === "failed" && x.error)) {
    lines.push(
      "",
      `<details><summary>${r.app} build failed</summary>`,
      "",
      "```",
      tail(r.error),
      "```",
      "",
      "</details>",
    )
  }
  lines.push("", `Latest commit: \`${String(sha).slice(0, 7)}\``)
  return lines.join("\n")
}

export function dockerPort(dockerfile, fallback = 3000) {
  const m = /\bPORT=(\d+)/.exec(dockerfile ?? "")
  return m ? Number(m[1]) : fallback
}

export function pickLatest(deployments) {
  return [...(deployments ?? [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null
}

// dokploy deployment status: running | done | error | cancelled
export function toStatus(deployment) {
  if (!deployment) return "building"
  if (deployment.status === "done") return "ready"
  if (deployment.status === "error" || deployment.status === "cancelled") return "failed"
  return "building"
}
