// Prints the sign in and database passwords of a PR preview. They are never posted on GitHub (public repo).
import { previewDb, previewSecret } from "./preview-lib.mjs"

const pr = Number(process.argv[2])
const token = process.env.DOKPLOY_TOKEN
if (!Number.isInteger(pr) || pr <= 0 || !token) {
  console.error("usage: DOKPLOY_TOKEN=... pnpm preview:creds <pr-number>")
  process.exit(1)
}

console.log(`demo and super admin password: ${previewSecret(token, pr, "demo")}`)
console.log(`postgres (database ritorno, user ritorno) password: ${previewDb(pr, token, "").password}`)
