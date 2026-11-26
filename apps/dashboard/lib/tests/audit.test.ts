import { expect, test } from "bun:test"
import { AUDIT_ACTIONS } from "@ritorno/common/audit"
import ar from "@ritorno/i18n/messages/ar.json"
import en from "@ritorno/i18n/messages/en.json"
import fr from "@ritorno/i18n/messages/fr.json"

test("every audit action has an en, fr and ar label", () => {
  const missing = Object.entries({ en, fr, ar }).flatMap(([locale, messages]) =>
    AUDIT_ACTIONS.filter((action) => {
      const label = action
        .split(".")
        .reduce<unknown>(
          (node, key) => (node as Record<string, unknown> | undefined)?.[key],
          messages.adminAudit.actions,
        )
      return typeof label !== "string"
    }).map((action) => `${locale}: ${action}`),
  )
  expect(missing).toEqual([])
})
