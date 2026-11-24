Machine translation of the new and changed English keys in `packages/i18n/src/messages/en.json` into French and Arabic. Opened by the `languine` workflow after a release, or by hand.

## Review checklist

Read the diff of `fr.json` and `ar.json` next to `en.json`. Fix the text in this branch, do not merge a translation you would not say to a guest.

**Tone**
- [ ] warm and hospitable, never cold or pushy, no marketing hype
- [ ] same tone as the existing strings, brand and product names left as they are

**Formality**
- [ ] French: `vous`, never `tu`
- [ ] Arabic: Modern Standard Arabic that a Tunisian guest reads without effort, polite register
- [ ] consent, unsubscribe and STOP wording is clear and exact, it is legal text

**Right to left**
- [ ] Arabic strings read correctly in the app with `dir="rtl"` (open the dashboard in Arabic)
- [ ] placeholders like `{name}` and numbers sit in the right place, mixed latin text (emails, urls, `WhatsApp`) is not scrambled
- [ ] no string depends on word order of the English one

**Mechanics**
- [ ] `pnpm i18n:check` passes (the workflow already ran it)
- [ ] `languine.lock` is part of the change
