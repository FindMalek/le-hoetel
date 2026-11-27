// On a release-please PR `package.json` already has the new version, so a version without notes fails ci there.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { CHANGE_GROUPS, RELEASES } from "../../apps/web/lib/releases.ts"

const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"))

test(`release ${version} has notes in en, fr and ar`, () => {
  const release = RELEASES.find((entry) => entry.version === version)
  assert.ok(release, `write the notes of ${version} in apps/web/lib/releases.ts (docs: releases)`)
  for (const text of [release.summary, ...CHANGE_GROUPS.flatMap((group) => release[group] ?? [])]) {
    for (const locale of ["en", "fr", "ar"]) assert.ok(text[locale]?.trim(), `${version}: empty ${locale} text`)
  }
})
