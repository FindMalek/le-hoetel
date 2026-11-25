import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { LOCALES } from "@le-hoetel/i18n/config"
import { GUEST_WHATSAPP_TEMPLATES, guestTemplateFooter } from "./whatsapp-guest"

const docs = readFileSync(new URL("../../../apps/docs/content/docs/whatsapp-templates.mdx", import.meta.url), "utf8")

test("the docs page holds the exact text of every template, the way it is submitted", () => {
  for (const template of Object.values(GUEST_WHATSAPP_TEMPLATES)) {
    expect(docs).toContain(template.name)
    for (const language of LOCALES) {
      expect(docs).toContain(template.body[language])
      expect(docs).toContain(guestTemplateFooter(language))
    }
  }
})

test("every variable of a body is declared, and a body never starts or ends with one", () => {
  for (const template of Object.values(GUEST_WHATSAPP_TEMPLATES)) {
    for (const language of LOCALES) {
      const body = template.body[language]
      const used = [...body.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1])
      expect(used).toEqual([...template.params])
      expect(body.startsWith("{{") || body.endsWith("}}")).toBe(false)
    }
  }
})
