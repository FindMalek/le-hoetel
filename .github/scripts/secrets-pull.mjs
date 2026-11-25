import { writeFileSync } from "node:fs"
import { formatDotenv, pullSecrets } from "./secrets-lib.mjs"

// node .github/scripts/secrets-pull.mjs <dev|staging|prod|preview> [out-file]
// Needs INFISICAL_URL, INFISICAL_PROJECT_ID, INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET. Prints values only to the file or stdout you choose, and the key count to stderr.
const [environment, out] = process.argv.slice(2)
const values = await pullSecrets(environment)
const dotenv = `${formatDotenv(values)}\n`
if (out) writeFileSync(out, dotenv, { mode: 0o600 })
else process.stdout.write(dotenv)
console.error(`${environment}: ${Object.keys(values).length} keys`)
