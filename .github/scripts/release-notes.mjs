import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

const version = JSON.parse(readFileSync(".release-please-manifest.json", "utf8"))["."]
const file = `docs/releases/${version}.md`
if (existsSync(file)) {
  console.log(`${file} exists, left as is`)
  process.exit(0)
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()
let range = "origin/main"
try {
  range = `${git("describe", "--tags", "--abbrev=0", "origin/main")}..origin/main`
} catch {}

const SKIP = /^(chore|ci|docs|test|refactor|build)(\(|:)/
const subjects = git("log", range, "--pretty=%s", "--no-merges")
  .split("\n")
  .filter((s) => s && !SKIP.test(s) && !s.startsWith("chore(main)"))
const clean = (s) => s.replace(/^\w+(\([^)]*\))?!?:\s*/, "").replace(/^./, (c) => c.toUpperCase())
const fixes = subjects.filter((s) => /^fix(\(|:)/.test(s)).map(clean)
const features = subjects.filter((s) => !/^fix(\(|:)/.test(s)).map(clean)

const list = (items) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- nothing yet")
mkdirSync("docs/releases", { recursive: true })
writeFileSync(
  file,
  `---
version: ${version}
videos: []
---

# Le Hoetel ${version}

## What is new

${list(features)}

## Fixes

${list(fixes)}
`,
)
console.log(`wrote ${file}`)
