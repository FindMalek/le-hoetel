import { expect, test } from "bun:test"
import { isWhatsappCapable, parsePhone } from "./phone"

test("every way of writing the same Tunisian mobile gives one E.164 number", () => {
  const forms = [
    "20123456",
    "20 123 456",
    "+216 20 123 456",
    "00216 20123456",
    "0021620123456",
    "(+216) 20-123-456",
    "٢٠١٢٣٤٥٦",
  ]
  for (const form of forms) expect(parsePhone(form)?.e164).toBe("+21620123456")
})

test("international numbers keep their country, junk and short numbers are refused", () => {
  expect(parsePhone("+33 6 12 34 56 78")).toMatchObject({ e164: "+33612345678", country: "FR" })
  expect(parsePhone("0033612345678")?.e164).toBe("+33612345678")
  for (const junk of ["", "abc", "1234", "+216 123", "612345678"]) expect(parsePhone(junk)).toBeNull()
})

test("a Tunisian landline is valid but not WhatsApp capable", () => {
  expect(parsePhone("71 123 456")).toMatchObject({ e164: "+21671123456", whatsappCapable: false })
  expect(isWhatsappCapable("+21698123456")).toBe(true)
})
