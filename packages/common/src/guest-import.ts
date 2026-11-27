import { parsePhone } from "./phone"

export const IMPORT_FIELDS = [
  "name",
  "phone",
  "email",
  "birthday",
  "language",
  "emailConsent",
  "whatsappConsent",
  "stayCheckIn",
  "stayCheckOut",
  "stayConsent",
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]
/** Column index per field, -1 when the file has none. */
export type ImportMapping = Record<ImportField, number>

type DataField = Exclude<ImportField, "emailConsent" | "whatsappConsent" | "stayConsent">

const GUESSES: Record<DataField, string[]> = {
  name: ["name", "nom", "full", "client", "guest", "اسم"],
  phone: ["phone", "tel", "mobile", "gsm", "whatsapp", "هاتف"],
  email: ["mail", "courriel", "بريد"],
  birthday: ["birth", "naissance", "anniv", "ميلاد"],
  language: ["lang", "langue", "لغة"],
  stayCheckIn: ["arriv", "check in", "checkin", "وصول"],
  stayCheckOut: ["depart", "check out", "checkout", "مغادرة"],
}

/** Lower case, no latin accents, `_ - .` read as spaces: `Accepte_les_E-mails` and `accepte les e mails` are one header. */
const normalise = (header: string) =>
  header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[_\-.\s]+/g, " ")
    .trim()

const CONSENT = /consent|accept|accord|autoris|agree|\bopt ?in\b|\bopt\b|موافق|يقبل/
/** A "yes" in these means no, so they are never read as anything. */
const REFUSAL = /\bopt ?out\b|unsubscri|desabonn|desinscri|refus|\bne pas\b|do not|إلغاء|رفض|عدم|بدون|غير مواف|لا يوافق/
/** `Pas de consentement`, `No email consent`, `N'accepte pas`. A trailing `(oui ou non)` is not one. */
const NEGATED =
  /\b(no|not|non|sans|pas|aucun|never|without|don'?t|doesn'?t)\b[^()/]{0,20}?(consent|accept|accord|agree|autoris|\bopt)|(consent|accept|accord|agree|autoris)\S* pas\b/
const EMAIL_WORD = /e ?mail|\bmail|courriel|newsletter|بريد|البريد/
const WHATSAPP_WORD = /whats ?app|\bwa\b|واتس/
const STAY_WORD = /stay|sejour|profile|إقامة|الإقامة/

export const sampleCells = (rows: string[][], column: number): string[] =>
  rows
    .map((row) => (row[column] ?? "").trim())
    .filter(Boolean)
    .slice(0, 5)

/**
 * Header words first, then what the cells look like (numbers that parse as phones, cells with an @), for files without
 * clear headers. A consent column is only matched when its header names what it grants: `unnamedConsent` lists the
 * ones that don't (`consent`, `accord`), for the hotel to assign by hand.
 */
export function guessImportColumns(
  headers: string[],
  rows: string[][],
): { mapping: ImportMapping; unnamedConsent: number[] } {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field, -1])) as ImportMapping
  const taken = new Set<number>()
  const take = (field: ImportField, index: number) => {
    if (mapping[field] >= 0) return
    mapping[field] = index
    taken.add(index)
  }
  const unnamedConsent: number[] = []
  const names = headers.map(normalise)

  // Consent columns first: "Accepte WhatsApp" is not the phone, "Consentement email" is not the address.
  for (const [index, name] of names.entries()) {
    const refusal = REFUSAL.test(name) || NEGATED.test(name)
    if (!refusal && !CONSENT.test(name)) continue
    taken.add(index)
    if (refusal) continue
    if (STAY_WORD.test(name)) {
      take("stayConsent", index)
      continue
    }
    const email = EMAIL_WORD.test(name)
    const whatsapp = WHATSAPP_WORD.test(name)
    if (email) take("emailConsent", index)
    if (whatsapp) take("whatsappConsent", index)
    if (!email && !whatsapp) unnamedConsent.push(index)
  }

  for (const [field, words] of Object.entries(GUESSES) as [DataField, string[]][]) {
    // word order is priority: a "telephone" column beats a "whatsapp" one
    for (const word of words) {
      const index = names.findIndex((name, at) => !taken.has(at) && name.includes(normalise(word)))
      if (index >= 0) {
        take(field, index)
        break
      }
    }
  }

  const byContent = (field: "phone" | "email", looksRight: (cell: string) => boolean) => {
    if (mapping[field] >= 0) return
    const index = headers.findIndex((_, at) => {
      const cells = sampleCells(rows, at)
      return !taken.has(at) && cells.length > 0 && cells.filter(looksRight).length / cells.length >= 0.6
    })
    if (index >= 0) take(field, index)
  }
  byContent("phone", (cell) => parsePhone(cell) !== null)
  byContent("email", (cell) => cell.includes("@"))
  return { mapping, unnamedConsent }
}
