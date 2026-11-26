import { expect, test } from "bun:test"
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, dirname, join } from "node:path"

const SCRIPT = join(import.meta.dir, "../../../../scripts/with-env.mjs")

/** A throwaway repo root with a fake `infisical` cli, running the real script. */
function run(infisical: string, dotenv: string, shell: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "with-env-"))
  mkdirSync(join(root, "scripts"))
  mkdirSync(join(root, "bin"))
  copyFileSync(SCRIPT, join(root, "scripts/with-env.mjs"))
  writeFileSync(join(root, ".env.example"), "DATABASE_URL=postgres://app:app@localhost:5432/app\n")
  writeFileSync(join(root, ".env"), dotenv)
  writeFileSync(join(root, "bin/infisical"), `#!/bin/sh\n${infisical}\n`)
  chmodSync(join(root, "bin/infisical"), 0o755)

  const print = "console.log([process.env.A, process.env.B, process.env.DATABASE_URL].join())"
  const result = Bun.spawnSync(["node", join(root, "scripts/with-env.mjs"), "node", "-e", print], {
    env: { ...shell, PATH: [join(root, "bin"), dirname(Bun.which("node") ?? ""), "/bin"].join(delimiter) },
  })
  return { out: result.stdout.toString().trim(), err: result.stderr.toString() }
}

test("infisical values win over .env, the database url defaults to .env.example", () => {
  const { out, err } = run(`echo '[{"key":"A","value":"infisical"}]'`, "A=file\nB=file\n")
  expect(out).toBe("infisical,file,postgres://app:app@localhost:5432/app")
  expect(err).toBe("")
})

test("falls back to .env with a warning when infisical cannot export", () => {
  const { out, err } = run("exit 1", "A=file\nDATABASE_URL=postgres://file\n")
  expect(out).toBe("file,,postgres://file")
  expect(err).toContain("using .env")
})

test("the default database url follows the POSTGRES_* overrides", () => {
  const { out } = run(`echo '[{"key":"POSTGRES_USER","value":"vault"}]'`, "POSTGRES_PORT=5440\nPOSTGRES_DB=file\n", {
    POSTGRES_PASSWORD: "shell",
  })
  expect(out).toBe(",,postgres://vault:shell@localhost:5440/file")
})
