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

test("only a header made entirely of known words is read as consent", () => {
  const consents = (header: string) => {
    const { mapping, unmatchedConsent } = guessImportColumns([header], [])
    const fields = (["emailConsent", "whatsappConsent", "stayConsent"] as const).filter((field) => mapping[field] === 0)
    return { fields, unmatched: unmatchedConsent.length === 1, email: mapping.email }
  }
  for (const header of [
    "consent",
    "Opt-out email",
    "Email consent withdrawn",
    "Email consent revoked",
    "Email consent declined",
    "Accord e-mail non obtenu",
    "Consentement e-mail retiré",
    "N'accepte plus WhatsApp",
    "N'accepte pas WhatsApp",
    "Pas de consentement e-mail",
    "No WhatsApp consent",
    "لا يقبل واتساب",
    "سحب الموافقة على واتساب",
    "عدم موافقة واتساب",
    "Accord e-mail (pas WhatsApp)",
    "Email stay consent",
  ]) {
    expect(consents(header), header).toEqual({ fields: [], unmatched: true, email: -1 })
  }

  for (const [header, fields] of [
    ["email_consent", ["emailConsent"]],
    ["Accord e-mail (oui ou non)", ["emailConsent"]],
    ["Marketing email consent (yes/no)", ["emailConsent"]],
    ["WhatsApp opt-in", ["whatsappConsent"]],
    ["Consent email and WhatsApp", ["emailConsent", "whatsappConsent"]],
    ["الموافقة على البريد الإلكتروني (نعم أو لا)", ["emailConsent"]],
    ["الموافقة على واتساب", ["whatsappConsent"]],
    ["Accord sur le séjour (oui ou non)", ["stayConsent"]],
    ["Stay details consent (yes or no)", ["stayConsent"]],
    ["الموافقة على تفاصيل الإقامة", ["stayConsent"]],
    ["consent_profile", ["stayConsent"]],
  ] as const) {
    expect(consents(header).fields, header).toEqual([...fields])
  }
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
