import { readFileSync } from "node:fs"

export const exampleKeys = () =>
  [...readFileSync(new URL("../.env.example", import.meta.url), "utf8").matchAll(/^#?[ \t]*([A-Z][A-Z0-9_]*)=/gm)].map(
    (m) => m[1],
  )

export const schemaKeys = (file) =>
  new Set(
    [
      ...readFileSync(new URL(`../packages/env/src/${file}.ts`, import.meta.url), "utf8").matchAll(
        /^\s*([A-Z][A-Z0-9_]*):/gm,
      ),
    ].map((m) => m[1]),
  )

export const declaredKeys = () => new Set([...schemaKeys("api"), ...schemaKeys("next")])

/** Which compose services must receive the keys of each `packages/env` schema. */
export const SCHEMA_SERVICES = { api: ["api", "worker"], next: ["web", "dashboard"] }

/** Set inside the image (Dockerfile ENV), not by compose. */
export const SET_BY_IMAGE = new Set(["NODE_ENV", "PORT"])

/** Keys only one of the schema's services reads: the http server alone decides whether to run jobs in-process. */
export const ONLY_IN = { JOBS_WORKER: "api" }

/**
 * The `environment` and `build.args` keys of each service in docker-compose.deploy.yml, with `<<: *anchor` merges
 * resolved. A small indentation reader for that one file, not a YAML parser.
 */
export const composeKeys = () => {
  const lines = readFileSync(new URL("../docker-compose.deploy.yml", import.meta.url), "utf8").split("\n")
  const anchors = {}
  const services = {}
  const indent = (line) => line.length - line.trimStart().length
  const readMap = (start, depth) => {
    const keys = new Set()
    for (let i = start; i < lines.length; i++) {
      const line = lines[i]
      if (!line.trim() || line.trim().startsWith("#")) continue
      if (indent(line) < depth) break
      const merge = line.match(/^\s*<<:\s*\*([\w-]+)/)
      if (merge) for (const k of anchors[merge[1]] ?? []) keys.add(k)
      const key = line.match(/^\s*([A-Z][A-Z0-9_]*):/)
      if (key && indent(line) === depth) keys.add(key[1])
    }
    return keys
  }
  let service = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const anchor = line.match(/^[\w-]+:\s*&([\w-]+)/)
    if (anchor) anchors[anchor[1]] = readMap(i + 1, 2)
    const svc = line.match(/^ {2}([\w-]+):\s*$/)
    if (svc) service = services[svc[1]] = { env: new Set(), args: new Set() }
    const block = line.match(/^ {4}environment:\s*$/) ? "env" : line.match(/^ {6}args:\s*$/) ? "args" : null
    if (service && block) for (const k of readMap(i + 1, indent(line) + 2)) service[block].add(k)
  }
  return services
}

/** In `.env.example` for docs or tooling, not validated by `packages/env`. */
export const NOT_IN_ENV_PACKAGE = new Set([
  "DOCS_URL",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_DB",
  "WHATSAPP_BUSINESS_ACCOUNT_ID",
  "TURBO_API",
  "TURBO_TEAM",
  "TURBO_TOKEN",
])

/** Set by the deploy scripts per environment, so Infisical does not hold them. */
export const COMPUTED = new Set([
  "DEPLOY_ENV",
  "GIT_SHA",
  "API_URL",
  "API_PUBLIC_URL",
  "WEB_URL",
  "DASHBOARD_URL",
  "DOCS_URL",
  "DATABASE_URL",
  "POSTGRES_PORT",
  "POSTGRES_USER",
  "POSTGRES_DB",
  "SEED",
  "MESSAGING_LIVE",
  "ALLOW_PREVIEW_ORIGINS",
  "S3_PREFIX",
  "JOBS_WORKER",
  "LOG_LEVEL",
  "TURBO_API",
  "TURBO_TEAM",
  "TURBO_TOKEN",
])
