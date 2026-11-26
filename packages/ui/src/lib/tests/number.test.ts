import { expect, test } from "bun:test"
import { formatDelta } from "../number"

test("deltas keep their sign and Western digits in Arabic", () => {
  expect(formatDelta(0.12, "ar", { style: "percent" })).toMatch(/^\D*\+\D*12/)
  expect(formatDelta(-3, "ar")).toMatch(/3/)
  expect(formatDelta(0, "fr")).toBe("0")
})
