// Runs a local command with the Infisical `dev` environment, or with the root .env when the cli cannot export it.
// Strongest wins: the shell, Infisical, .env, then the local docker database built from .env.example (Infisical holds none).
import { execFileSync, spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

const root = fileURLToPath(new URL("..", import.meta.url))

const readEnvFile = (name) => (existsSync(`${root}/${name}`) ? parseEnv(readFileSync(`${root}/${name}`, "utf8")) : {})

const infisicalSecrets = () => {
  // INFISICAL_PROXY reaches the cli only: the apps cannot speak socks.
  const proxy = process.env.INFISICAL_PROXY
  try {
    const out = execFileSync("infisical", ["export", "--env=dev", "--format=json", "--silent"], {
      cwd: root,
      env: proxy ? { ...process.env, HTTPS_PROXY: proxy } : process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
    })
    return Object.fromEntries(JSON.parse(out).map(({ key, value }) => [key, value]))
  } catch {
    console.warn("with-env: cannot read Infisical (cli missing, not logged in or unreachable), using .env only")
    return {}
  }
}

/** The .env.example url with whatever POSTGRES_* overrides docker compose gets, so both point at the same database. */
const localDatabaseUrl = ({ POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_DB }) => {
  const url = new URL(readEnvFile(".env.example").DATABASE_URL)
  if (POSTGRES_USER) url.username = POSTGRES_USER
  if (POSTGRES_PASSWORD) url.password = POSTGRES_PASSWORD
  if (POSTGRES_PORT) url.port = POSTGRES_PORT
  if (POSTGRES_DB) url.pathname = POSTGRES_DB
  return url.href
}

const env = { ...readEnvFile(".env"), ...infisicalSecrets(), ...process.env }
env.DATABASE_URL ||= localDatabaseUrl(env)

const [command, ...args] = process.argv.slice(2)
const child = spawn(command, args, { env, stdio: "inherit" })
// Ctrl-C reaches the child through the terminal: stay alive until it has shut down.
process.on("SIGINT", () => {})
process.on("SIGTERM", () => child.kill("SIGTERM"))
child.on("error", (error) => {
  console.error(`with-env: ${error.message}`)
  process.exit(1)
})
child.on("exit", (code) => process.exit(code ?? 1))
