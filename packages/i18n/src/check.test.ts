import { expect, test } from "bun:test"
import { checkMessages, extractUsages } from "./check"

const en = { hero: { title: "Hi", cta: "Go" }, status: { up: "Up", down: "Down" }, old: "Old" }

test("a key used but not in english is missing and one in english nobody uses is unused", () => {
  const source = extractUsages(`const t = await getTranslations("hero")\nt("title")\nt("nope")`, "a.tsx")
  const problems = checkMessages({ en, others: {}, sources: [source], files: ["a.tsx"] })
  expect(problems.filter((p) => p.kind === "missing").map((p) => p.message)).toEqual([
    'a.tsx:3 uses "nope" which is not in en.json',
  ])
  expect(problems.filter((p) => p.kind === "unused").map((p) => p.message)).toEqual([
    '"hero.cta" is in en.json but no code uses it',
    '"status.up" is in en.json but no code uses it',
    '"status.down" is in en.json but no code uses it',
    '"old" is in en.json but no code uses it',
  ])
})

const dyn = (prefix: string) => ["`", prefix, "$", "{state}`"].join("")

test("a dynamic key uses everything under its prefix and the keep comment covers the rest", () => {
  const source = extractUsages(
    [`const t = useTranslations("status")`, `t(${dyn("")})`, "// i18n-used: hero.cta", `t("old")`].join("\n"),
    "b.tsx",
  )
  expect(source.usages.map((u) => [u.key, u.dynamic])).toEqual([
    ["", true],
    ["old", false],
  ])
  const problems = checkMessages({ en, others: {}, sources: [source], files: ["b.tsx"] })
  expect(problems.map((p) => p.message)).toEqual(['"hero.title" is in en.json but no code uses it'])
})

test("a translation key that english does not have is stale", () => {
  const problems = checkMessages({
    en: { a: "A" },
    others: { fr: { a: "A", gone: "x" } },
    sources: [extractUsages(`t("a")`, "c.tsx")],
    files: ["c.tsx"],
  })
  expect(problems.map((p) => p.message)).toEqual(['"gone" is in fr.json but not in en.json'])
})
