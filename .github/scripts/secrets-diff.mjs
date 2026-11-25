import { appendFileSync } from "node:fs"
import { COMPUTED, exampleKeys } from "../../scripts/env-keys.mjs"
import { ENVIRONMENTS, pullSecrets } from "./secrets-lib.mjs"

// Lists, per environment, the keys of .env.example that Infisical does not have. Names only, never values.
const wanted = exampleKeys().filter((k) => !COMPUTED.has(k))
let missingAny = false
const lines = []
for (const environment of ENVIRONMENTS) {
  const have = new Set(Object.keys(await pullSecrets(environment)))
  const missing = wanted.filter((k) => !have.has(k))
  if (missing.length) missingAny = true
  lines.push(`- ${environment}: ${missing.length ? missing.map((k) => `\`${k}\``).join(", ") : "nothing missing"}`)
}
const report = `### Keys missing in Infisical\n\n${lines.join("\n")}\n`
console.log(report)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
process.exit(missingAny ? 1 : 0)
