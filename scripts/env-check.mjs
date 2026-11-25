import { declaredKeys, exampleKeys, NOT_IN_ENV_PACKAGE } from "./env-keys.mjs"

const declared = declaredKeys()
const missing = exampleKeys().filter((k) => !declared.has(k) && !NOT_IN_ENV_PACKAGE.has(k))
if (missing.length) {
  console.error(`in .env.example but not declared in packages/env: ${missing.join(", ")}`)
  console.error(
    "declare the key in packages/env/src (api.ts or next.ts), or list it in NOT_IN_ENV_PACKAGE in scripts/env-keys.mjs",
  )
  process.exit(1)
}
console.log("env keys ok")
