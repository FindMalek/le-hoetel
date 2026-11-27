import { expect, test } from "bun:test"
import { guessImportColumns } from "../guest-import"
import { guestFromImportRow } from "../schemas"

test("french headers map each consent to its channel, never to the phone or the address", () => {
  const headers = [
    "Accepte WhatsApp",
    "Consentement e-mail",
    "Accord séjour",
    "Nom",
    "Téléphone",
    "E-mail",
    "Date de départ",
  ]
  expect(guessImportColumns(headers, []).mapping).toMatchObject({
    whatsappConsent: 0,
    emailConsent: 1,
    stayConsent: 2,
    name: 3,
    phone: 4,
    email: 5,
    stayCheckOut: 6,
  })
})

test("a consent header that names no channel, or that means refusal, grants nothing by itself", () => {
  const guess = guessImportColumns(["name", "phone", "consent", "Opt-out email"], [])
  expect(guess.mapping).toMatchObject({ emailConsent: -1, whatsappConsent: -1, email: -1 })
  expect(guess.unnamedConsent).toEqual([2])
})

test("oui and vrai grant only their own channel, non and anything unclear grant nothing", () => {
  const consents = (emailConsent: string, whatsappConsent: string) =>
    guestFromImportRow(
      { line: 2, phone: "20 123 456", email: "a@example.test", emailConsent, whatsappConsent },
      { defaultLanguage: "fr", confirmConsent: true },
    ).consents
  expect(consents(" OUI ", "non")).toMatchObject({ email: true, whatsapp: false })
  expect(consents("peut-être", "VRAI")).toMatchObject({ email: false, whatsapp: true })
})
