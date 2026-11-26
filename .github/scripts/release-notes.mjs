// Next version from the last vX.Y.Z tag, notes from the PRs merged since, grouped by their type:* label.
import { execFileSync } from "node:child_process"
import { appendFileSync, writeFileSync } from "node:fs"

const { BUMP = "auto", NOTES_FILE = "release-notes.md", GITHUB_OUTPUT } = process.env
const run = (cmd, ...args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim()

const lastTag = run("git", "tag", "--merged", "HEAD", "--list", "v[0-9]*", "--sort=-v:refname").split("\n")[0]

const [major, minor, patch] = (lastTag ? lastTag.slice(1) : "0.0.0").split(".").map(Number)
const inRange = new Set(run("git", "rev-list", lastTag ? `${lastTag}..HEAD` : "HEAD").split("\n"))
const prs = JSON.parse(
  run(
    "gh",
    ...["pr", "list", "--state", "merged", "--base", "main", "--limit", "1000"],
    ...["--json", "number,title,labels,mergeCommit"],
  ),
).filter((p) => p.mergeCommit && inRange.has(p.mergeCommit.oid))

const hasLabel = (name) => prs.some((p) => p.labels.some((l) => l.name === name))
// auto: minor when a feature shipped, patch otherwise
const bump = BUMP === "auto" ? (hasLabel("type:feature") ? "minor" : "patch") : BUMP
const version = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}[bump]
if (!version) throw new Error(`BUMP must be auto, major, minor or patch, got ${BUMP}`)
// Nothing merged since the last tag: no release (the automatic run fires after every staging deploy).
const skip = prs.length === 0

const GROUPS = [
  ["type:feature", "What is new"],
  ["type:bug", "Fixes"],
  ["type:docs", "Docs"],
  ["type:chore", "Maintenance"],
]
const groupOf = (p) => GROUPS.find(([label]) => p.labels.some((l) => l.name === label))?.[1] ?? "Other"
const sections = [...GROUPS.map(([, title]) => title), "Other"]
  .map((title) => [title, prs.filter((p) => groupOf(p) === title).sort((a, b) => a.number - b.number)])
  .filter(([, items]) => items.length)
  .map(([title, items]) => `## ${title}\n\n${items.map((p) => `- ${p.title} (#${p.number})`).join("\n")}`)

const notes = `# Ritorno ${version}\n\n${sections.join("\n\n") || "Nothing merged since the last release."}\n`
writeFileSync(NOTES_FILE, notes)
if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, `version=${version}\ntag=v${version}\nskip=${skip}\n`)
console.log(`v${version} (previous ${lastTag || "none"}, ${prs.length} PRs)\n\n${notes}`)
