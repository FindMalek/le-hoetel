// Runs a local command with the Infisical `dev` environment, or with the root .env when the cli cannot export it.
// Strongest wins: the shell, Infisical, .env, then the local docker database of .env.example (Infisical holds none).
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

const env = {
  DATABASE_URL: readEnvFile(".env.example").DATABASE_URL,
  ...readEnvFile(".env"),
  ...infisicalSecrets(),
  ...process.env,
}

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
