import {
  composeKeys,
  declaredKeys,
  exampleKeys,
  NOT_IN_ENV_PACKAGE,
  ONLY_IN,
  SCHEMA_SERVICES,
  SET_BY_IMAGE,
  schemaKeys,
} from "./env-keys.mjs"

const fail = (lines) => {
  for (const line of lines) console.error(line)
  process.exit(1)
}

const declared = declaredKeys()
const missing = exampleKeys().filter((k) => !declared.has(k) && !NOT_IN_ENV_PACKAGE.has(k))
if (missing.length) {
  fail([
    `in .env.example but not declared in packages/env: ${missing.join(", ")}`,
    "declare the key in packages/env/src (api.ts or next.ts), or list it in NOT_IN_ENV_PACKAGE in scripts/env-keys.mjs",
  ])
}

// GIT_SHA reaches the api as a build arg, NEXT_PUBLIC_* are inlined by `next build` so they need the build arg too.
const services = composeKeys()
const gaps = []
for (const [schema, names] of Object.entries(SCHEMA_SERVICES)) {
  for (const key of schemaKeys(schema)) {
    if (SET_BY_IMAGE.has(key)) continue
    for (const name of names) {
      if (ONLY_IN[key] && ONLY_IN[key] !== name) continue
      const service = services[name]
      const passed = key === "GIT_SHA" ? service?.args.has(key) : service?.env.has(key)
      if (!passed) gaps.push(`${name}: ${key}${key === "GIT_SHA" ? " (build arg)" : ""}`)
      if (key.startsWith("NEXT_PUBLIC_") && !service?.args.has(key)) gaps.push(`${name}: ${key} (build arg)`)
    }
  }
}
if (gaps.length) {
  fail([
    `docker-compose.deploy.yml does not pass:\n  ${gaps.join("\n  ")}`,
    "add each key to the service, `${KEY:-}` when it is optional",
  ])
}
console.log("env keys ok")
