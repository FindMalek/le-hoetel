// Warns (never fails) when code under apps/ or packages/ changed and apps/docs did not. Label `no-docs` skips it.
// Env: BASE_SHA, HEAD_SHA, PR_LABELS (json array of label names).
import { execFileSync } from "node:child_process"

const { BASE_SHA, HEAD_SHA, PR_LABELS = "[]" } = process.env

if (JSON.parse(PR_LABELS).includes("no-docs")) {
  console.log("label no-docs, docs check skipped")
  process.exit(0)
}

const files = execFileSync("git", ["diff", "--name-only", `${BASE_SHA}...${HEAD_SHA}`], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)

const isDocs = (file) => file.startsWith("apps/docs/")
const isCode = (file) => /^(apps|packages)\//.test(file) && !isDocs(file)

if (files.some(isCode) && !files.some(isDocs)) {
  console.log(
    "::warning::code under apps/ or packages/ changed but apps/docs did not. Update the docs or add the `no-docs` label",
  )
} else {
  console.log("docs ok")
}
