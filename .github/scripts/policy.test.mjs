import assert from "node:assert/strict"
import { test } from "node:test"
import { isBotIdentity } from "./policy.mjs"

test("a dependabot git identity is a bot, a person is not", () => {
  assert.equal(isBotIdentity("dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>"), true)
  assert.equal(isBotIdentity("Sam Doe <sam[bot]@example.com>"), false)
})
