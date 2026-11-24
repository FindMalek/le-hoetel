import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { checkMessages, type Extracted, extractUsages, type Tree, untranslated } from "./check"

const ROOT = join(import.meta.dir, "../../..")
const SKIP = new Set(["node_modules", ".next", ".turbo", "dist", "out", ".git"])

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return []
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const files = ["apps", "packages"].flatMap((dir) => walk(join(ROOT, dir)))
const messageFiles = files.filter((f) => /\/messages\/[a-z-]+\.json$/.test(f))
const sourceFiles = files.filter((f) => /\.(ts|tsx)$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f))

const load = (path: string): Tree => JSON.parse(readFileSync(path, "utf8"))
const english = messageFiles.filter((f) => f.endsWith("/en.json"))
if (english.length !== 1) {
  console.error(`expected one messages/en.json, found ${english.length}`)
  process.exit(1)
}
const [enPath = ""] = english
const others = Object.fromEntries(
  messageFiles
    .filter((f) => f !== enPath && join(f, "..") === join(enPath, ".."))
    .map((f) => [f.split("/").pop()?.replace(".json", "") ?? f, load(f)]),
)

const extracted: Extracted[] = sourceFiles.map((f) => extractUsages(readFileSync(f, "utf8"), relative(ROOT, f)))
const problems = checkMessages({
  en: load(enPath),
  others,
  sources: extracted,
  files: sourceFiles.map((f) => relative(ROOT, f)),
})

for (const [locale, tree] of Object.entries(others)) {
  const missing = untranslated(load(enPath), tree)
  if (missing.length)
    console.warn(
      `${locale}: ${missing.length} key(s) fall back to English (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", …" : ""})`,
    )
}
for (const problem of problems) console.error(`${problem.kind}: ${problem.message}`)
if (problems.length) process.exit(1)
console.log(`i18n keys ok (${messageFiles.length} files, ${sourceFiles.length} sources)`)
