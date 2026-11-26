import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const script = (name) => join(import.meta.dirname, name)
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
const checkPr = (env) =>
  spawnSync("node", [script("check-pr.mjs")], {
    encoding: "utf8",
    env: { ...process.env, BASE_SHA: head, HEAD_SHA: head, PR_AUTHOR: "dev", ...env },
  })

test("a PR title release-please cannot read fails", () => {
  const body = { PR_BODY: "closes #1" }
  assert.equal(checkPr({ ...body, PR_TITLE: "Weekly owner digest" }).status, 1)
  assert.equal(checkPr({ ...body, PR_TITLE: "feat(digest): add owner digest" }).status, 0)
})

test("the release PR needs no issue link or labels, a fork cannot claim it", () => {
  const release = { PR_TITLE: "chore(main): release 0.5.0", HEAD_REF: "release-please--branches--main" }
  assert.equal(checkPr({ ...release, FROM_FORK: "false" }).status, 0)
  assert.equal(checkPr({ ...release, FROM_FORK: "true" }).status, 1)
  const labels = spawnSync("node", [script("check-labels.mjs")], {
    env: { ...process.env, ...release, FROM_FORK: "false", PR_AUTHOR: "dev", PR_LABELS: "[]" },
  })
  assert.equal(labels.status, 0)
})

test("the release email drops release-please links and markup", () => {
  const cwd = mkdtempSync(join(tmpdir(), "release-email-"))
  mkdirSync(join(cwd, "docs/releases"), { recursive: true })
  writeFileSync(
    join(cwd, "docs/releases/0.5.0.md"),
    "## [0.5.0](https://x/compare) (2026-11-26)\n\n### Features\n\n* **digest:** add it ([#9](https://x/9)) ([abc1234](https://x/c))\n",
  )
  const out = execFileSync("node", [script("release-email.mjs")], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, VERSION: "0.5.0", DRY_RUN: "true" },
  })
  assert.match(out, /<h2>0\.5\.0 \(2026-11-26\)<\/h2>\n\n<h2>Features<\/h2>\n\n<p>• digest: add it \(#9\)<\/p>/)
})
