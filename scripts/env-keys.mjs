import { readFileSync } from "node:fs"

export const exampleKeys = () =>
  [...readFileSync(new URL("../.env.example", import.meta.url), "utf8").matchAll(/^#?[ \t]*([A-Z][A-Z0-9_]*)=/gm)].map(
    (m) => m[1],
  )

export const declaredKeys = () => {
  const src = ["api", "next"].map((f) => readFileSync(new URL(`../packages/env/src/${f}.ts`, import.meta.url), "utf8"))
  return new Set([...src.join("\n").matchAll(/^\s*([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1]))
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
