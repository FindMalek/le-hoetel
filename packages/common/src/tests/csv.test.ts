import { expect, test } from "bun:test"
import { parseCsv, toCsv } from "../csv"

test("parses quotes, semicolons and a bom, and skips blank lines", () => {
  expect(parseCsv('\uFEFFnom;tel\r\n"Ben ""Ali"", Amel";20 123 456\r\n\r\nLeila;"98\n765"\r\n')).toEqual([
    ["nom", "tel"],
    ['Ben "Ali", Amel', "20 123 456"],
    ["Leila", "98\n765"],
  ])
})

test("the report neutralises formulas and round trips", () => {
  const csv = toCsv([["name"], ["=HYPERLINK(1)"], ['a "b"']])
  expect(parseCsv(csv)).toEqual([["name"], ["'=HYPERLINK(1)"], ['a "b"']])
})
