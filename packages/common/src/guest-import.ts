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

/** Headers that talk about consent, whatever they say: never a data column, matched only if the lists below read them. */
const ABOUT_CONSENT =
  /consent|accept|accord|autoris|agree|\bopt( ?in| ?out)?\b|unsubscri|desabonn|desinscri|refus|موافق|يقبل|رفض/

const words = (list: string) => new Set(list.split(" ").map(normalise))
/*
 * An allow list: a consent header is only read when every word of it is below. Anything else (`not`, `pas`,
 * `withdrawn`, `retiré`, `سحب`) may turn a yes into a no, so the hotel picks that column by hand.
 */
const CONSENT_WORDS = words(
  "consent consents consented consentement accord accept accepts accepted accepte agree agrees agreed agreement autorisation autorise opt optin in موافقة الموافقة موافق يقبل",
)
const EMAIL_WORDS = words("email emails mail mails courriel courriels newsletter البريد بريد الإلكتروني الالكتروني")
const WHATSAPP_WORDS = words("whatsapp wa واتساب الواتساب")
const STAY_WORDS = words("stay sejour profile الإقامة إقامة")
const FILLER_WORDS = words(
  "marketing message messages detail details dates guest and by via to for the of on et par pour le la les l de des du d sur a aux تفاصيل تواريخ الرسائل على عبر و",
)
/** `(oui ou non)`, `yes/no`, `نعم أو لا` at the end of a header says how cells are filled in, nothing else. */
const VALUE_HINT =
  /\s*[([]?\s*(?:(?:yes|oui|true|vrai)\s*(?:\/|\||\bor\b|\bou\b)\s*(?:no|non|false|faux)|[yo]\s*\/\s*n|نعم\s*(?:\/|\||أو|او)\s*لا)\s*[)\]]?\s*[?:*]*$/

type ConsentField = "emailConsent" | "whatsappConsent" | "stayConsent"

/** What a consent header grants, empty when any of it is unclear. */
function consentFields(header: string): ConsentField[] {
  const tokens = header
    .replace(VALUE_HINT, "")
    .replace(/\be mail/g, "email")
    .replace(/\bwhats app\b/g, "whatsapp")
    .split(/[\s()[\]/|,;:?!*+&'’"«»]+/)
    .filter(Boolean)
  const known = [CONSENT_WORDS, EMAIL_WORDS, WHATSAPP_WORDS, STAY_WORDS, FILLER_WORDS]
  const has = (set: Set<string>) => tokens.some((token) => set.has(token))
  if (!has(CONSENT_WORDS) || !tokens.every((token) => known.some((set) => set.has(token)))) return []
  const channels: ConsentField[] = []
  if (has(EMAIL_WORDS)) channels.push("emailConsent")
  if (has(WHATSAPP_WORDS)) channels.push("whatsappConsent")
  // stay and a channel in one header is two different consents: unclear
  if (has(STAY_WORDS)) return channels.length ? [] : ["stayConsent"]
  return channels
}

export const sampleCells = (rows: string[][], column: number): string[] =>
  rows
    .map((row) => (row[column] ?? "").trim())
    .filter(Boolean)
    .slice(0, 5)

/**
 * Header words first, then what the cells look like (numbers that parse as phones, cells with an @), for files without
 * clear headers. `unmatchedConsent` lists the consent looking columns left for the hotel to assign by hand.
 */
export function guessImportColumns(
  headers: string[],
  rows: string[][],
): { mapping: ImportMapping; unmatchedConsent: number[] } {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field, -1])) as ImportMapping
  const taken = new Set<number>()
  const take = (field: ImportField, index: number) => {
    if (mapping[field] >= 0) return
    mapping[field] = index
    taken.add(index)
  }
  const unmatchedConsent: number[] = []
  const names = headers.map(normalise)

  // Consent columns first: "Accepte WhatsApp" is not the phone, "Consentement email" is not the address.
  for (const [index, name] of names.entries()) {
    if (!ABOUT_CONSENT.test(name)) continue
    taken.add(index)
    const free = consentFields(name).filter((field) => mapping[field] < 0)
    for (const field of free) take(field, index)
    if (!free.length) unmatchedConsent.push(index)
  }

  for (const [field, aliases] of Object.entries(GUESSES) as [DataField, string[]][]) {
    // word order is priority: a "telephone" column beats a "whatsapp" one
    for (const word of aliases) {
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
  return { mapping, unmatchedConsent }
}
