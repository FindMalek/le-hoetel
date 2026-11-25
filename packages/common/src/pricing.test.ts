import { expect, test } from "bun:test"
import { whatsappPriceMillimes } from "./pricing"

test("the price is cost plus 25 percent rounded up, and unknown types use the dearest rate", () => {
  expect(whatsappPriceMillimes("welcome")).toBe(32)
  expect(whatsappPriceMillimes("birthday")).toBe(119)
  expect(whatsappPriceMillimes("something-new")).toBe(119)
})
