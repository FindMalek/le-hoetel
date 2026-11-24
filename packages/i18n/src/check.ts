export type Tree = { [key: string]: string | Tree }

export interface Usage {
  file: string
  line: number
  key: string
  dynamic: boolean
}

export interface Extracted {
  namespaces: Set<string>
  usages: Usage[]
  kept: string[]
}

export interface Problem {
  kind: "missing" | "unused" | "stale"
  message: string
}

export function flatten(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : flatten(value, `${prefix}${key}.`),
  )
}

const NAMESPACE = /\b(?:useTranslations|getTranslations)\(\s*(?:\{\s*[^}]*?namespace:\s*)?["']([\w.-]+)["']/g
const CALL = /(?<![\w.$])t(?:\.(?:rich|raw|markup|has))?\(\s*(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g
const KEEP = /i18n-used:\s*([\w.-]+)/g

/** Every `t("key")` in a file with the namespaces its `useTranslations`/`getTranslations` calls name. The translator variable must be called `t`. */
export function extractUsages(code: string, file: string): Extracted {
  let source = code
  const kept = [...code.matchAll(KEEP)].map((m) => m[1] ?? "")
  source = source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/.*$/gm, "$1")
  const namespaces = new Set([...source.matchAll(NAMESPACE)].map((m) => m[1] ?? ""))
  const usages: Usage[] = []
  for (const match of source.matchAll(CALL)) {
    const quote = match[1]
    const raw = match[2] ?? ""
    const line = source.slice(0, match.index).split("\n").length
    const dynamic = quote === "`" && raw.includes("${")
    if (dynamic) usages.push({ file, line, key: raw.slice(0, raw.indexOf("${")), dynamic })
    else usages.push({ file, line, key: raw, dynamic })
  }
  return { namespaces, usages, kept }
}

/**
 * English is the source of truth: a key used in code but absent from `en` is missing, a key in `en` that no code
 * uses is unused, and a key in another language that `en` does not have is stale. A key missing from fr or ar is
 * fine, it falls back to English until the next translation run.
 */
export function checkMessages(input: {
  en: Tree
  others: Record<string, Tree>
  sources: Extracted[]
  files: string[]
}): Problem[] {
  const keys = flatten(input.en)
  const known = new Set(keys)
  const used = new Set<string>()
  const problems: Problem[] = []

  for (const [index, source] of input.sources.entries()) {
    const namespaced = [...source.namespaces].map((ns) => `${ns}.`)
    for (const usage of source.usages) {
      const bases = usage.dynamic && usage.key === "" ? namespaced : ["", ...namespaced]
      const hits = bases
        .map((base) => `${base}${usage.key}`)
        .flatMap((candidate) =>
          usage.dynamic ? keys.filter((k) => k.startsWith(candidate)) : known.has(candidate) ? [candidate] : [],
        )
      for (const hit of hits) used.add(hit)
      if (hits.length === 0 && usage.key !== "") {
        const where = `${input.files[index] ?? usage.file}:${usage.line}`
        problems.push({
          kind: "missing",
          message: `${where} uses "${usage.key}${usage.dynamic ? "…" : ""}" which is not in en.json`,
        })
      }
    }
    for (const prefix of source.kept) for (const key of keys) if (key.startsWith(prefix)) used.add(key)
  }

  for (const key of keys)
    if (!used.has(key)) problems.push({ kind: "unused", message: `"${key}" is in en.json but no code uses it` })
  for (const [locale, tree] of Object.entries(input.others))
    for (const key of flatten(tree))
      if (!known.has(key)) problems.push({ kind: "stale", message: `"${key}" is in ${locale}.json but not in en.json` })
  return problems
}

export function untranslated(en: Tree, other: Tree): string[] {
  const have = new Set(flatten(other))
  return flatten(en).filter((key) => !have.has(key))
}
