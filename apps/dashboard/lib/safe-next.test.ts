import { expect, test } from "bun:test"
import { safeNext } from "./safe-next"

test("only same-site paths survive as the sign-in redirect", () => {
  expect(safeNext("/accept-invitation/abc?x=1")).toBe("/accept-invitation/abc?x=1")
  for (const bad of ["//evil.test", "https://evil.test", "/\\evil.test", "/\t/evil.test", "", undefined])
    expect(safeNext(bad)).toBe("/")
})
