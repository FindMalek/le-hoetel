// Fails a pull request that misses a milestone, priority, area, owner, type or size label.
// Env: PR_LABELS (json array of label names), PR_AUTHOR, HEAD_REF, FROM_FORK.
import { isBot, isReleasePr } from "./policy.mjs"

const REQUIRED = [
  { name: "milestone", re: /^milestone:\d+$/, hint: "milestone:N" },
  { name: "priority", re: /^P[0-3]$/, hint: "P0, P1, P2 or P3" },
  { name: "area", re: /^area:.+$/, hint: "area:*" },
  { name: "owner", re: /^owner:.+$/, hint: "owner:*" },
  { name: "type", re: /^type:.+$/, hint: "type:*" },
  { name: "size", re: /^size:[SML]$/, hint: "size:S, size:M or size:L" },
]

const { PR_LABELS = "[]", PR_AUTHOR = "", HEAD_REF, FROM_FORK } = process.env

if (isBot(PR_AUTHOR) || isReleasePr(HEAD_REF, FROM_FORK)) {
  console.log("bot or release pull request, label check skipped")
  process.exit(0)
}

const labels = JSON.parse(PR_LABELS)
const problems = REQUIRED.filter(({ re }) => !labels.some((label) => re.test(label))).map(
  ({ name, hint }) => `missing ${name} label (${hint})`,
)

if (problems.length > 0) {
  for (const problem of problems) console.error(`::error::${problem}`)
  process.exit(1)
}
console.log("labels ok")
