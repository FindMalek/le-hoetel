/** Country calling codes, the main country of a shared code first. A test keeps it in step with libphonenumber. */
const TABLE =
  "US1 RU7 EG20 ZA27 GR30 NL31 BE32 FR33 ES34 HU36 IT39 RO40 CH41 AT43 GB44 DK45 SE46 NO47 PL48 DE49 PE51 MX52 CU53 AR54 BR55 CL56 CO57 VE58 MY60 AU61 ID62 PH63 NZ64 SG65 TH66 JP81 KR82 VN84 CN86 TR90 IN91 PK92 AF93 LK94 MM95 IR98 SS211 MA212 DZ213 TN216 LY218 GM220 SN221 MR222 ML223 GN224 CI225 BF226 NE227 TG228 BJ229 MU230 LR231 SL232 GH233 NG234 TD235 CF236 CM237 CV238 ST239 GQ240 GA241 CG242 CD243 AO244 GW245 IO246 AC247 SC248 SD249 RW250 ET251 SO252 DJ253 KE254 TZ255 UG256 BI257 MZ258 ZM260 MG261 RE262 ZW263 NA264 MW265 LS266 BW267 SZ268 KM269 SH290 ER291 AW297 FO298 GL299 GI350 PT351 LU352 IE353 IS354 AL355 MT356 CY357 FI358 BG359 LT370 LV371 EE372 MD373 AM374 BY375 AD376 MC377 SM378 UA380 RS381 ME382 XK383 HR385 SI386 BA387 MK389 CZ420 SK421 LI423 FK500 BZ501 GT502 SV503 HN504 NI505 CR506 PA507 PM508 HT509 GP590 BO591 GY592 EC593 GF594 PY595 MQ596 SR597 UY598 CW599 TL670 NF672 BN673 NR674 PG675 TO676 SB677 VU678 FJ679 PW680 WF681 CK682 NU683 WS685 KI686 NC687 TV688 PF689 TK690 FM691 MH692 KP850 HK852 MO853 KH855 LA856 BD880 TW886 MV960 LB961 JO962 SY963 IQ964 KW965 SA966 YE967 OM968 PS970 AE971 IL972 BH973 QA974 BT975 MN976 NP977 TJ992 TM993 AZ994 GE995 KG996 UZ998 AG1 AI1 AS1 AX358 BB1 BL590 BM1 BQ599 BS1 CA1 CC61 CX61 DM1 DO1 EH212 GD1 GG44 GU1 IM44 JE44 JM1 KN1 KY1 KZ7 LC1 MF590 MP1 MS1 PR1 SJ47 SX1 TA290 TC1 TT1 VA39 VC1 VG1 VI1 YT262"

export const DIAL_COUNTRIES: readonly { country: string; code: string }[] = TABLE.split(" ").map((entry) => ({
  country: entry.slice(0, 2),
  code: entry.slice(2),
}))

export const dialCodeOf = (country: string): string =>
  DIAL_COUNTRIES.find((item) => item.country === country)?.code ?? "216"

const ARABIC_DIGITS = /[٠-٩۰-۹]/g
export const toLatinDigits = (text: string): string =>
  text.replace(ARABIC_DIGITS, (digit) => String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit) % 10))

/** What the phone field holds: the chosen country and the text next to it. */
export interface PhoneValue {
  country: string
  national: string
  /** The browser's region, kept while the guest has not chosen a country themselves. */
  detected?: string
}

/**
 * Reads what was typed or pasted. A leading `+` or `00` with a known calling code switches the country and leaves the
 * rest; until the code is complete (or if it is unknown) the text stays as it is. The current country wins a shared code.
 */
export function readPhone(input: string, current: PhoneValue): PhoneValue {
  const { country } = current
  const text = toLatinDigits(input)
    .replace(/\(\s*0\s*\)/g, " ")
    .replace(/[-.()/ ]/g, " ")
    .replace(/[^\d+\s]/g, "")
    .trimStart()
  const prefix = text.match(/^(\+|00)/)?.[0]
  if (!prefix) return { ...current, national: text.replace(/\+/g, "") }
  const rest = text.slice(prefix.length).replace(/\+/g, "").trimStart()
  for (let length = 1; length <= 3; length++) {
    const code = rest.slice(0, length)
    const matches = DIAL_COUNTRIES.filter((item) => item.code === code)
    const match = matches.find((item) => item.country === country) ?? matches[0]
    if (match) return { country: match.country, national: rest.slice(length).trimStart() }
  }
  return { ...current, national: `${prefix}${rest}` }
}

/** The number to send: `+33 6 12 34 56 78`. The server drops the trunk zero where a country has one. */
export function toInternational({ country, national }: PhoneValue): string {
  const text = national.trim()
  if (!text) return ""
  if (text.startsWith("+") || text.startsWith("00")) return text
  // Tunisia has no trunk prefix, but a zero typed out of habit should not block the guest
  return `+${dialCodeOf(country)} ${country === "TN" ? text.replace(/^0+/, "") : text}`
}

/** A rough check for the form, the server does the real one. */
export function isPhoneComplete(number: string): boolean {
  const digits = number.replace(/\D/g, "").length
  return digits >= 7 && digits <= 17
}

/** The region of the first browser language that names one (`fr-BE`). A bare `fr` or `ar` says nothing. */
export function countryFromLocales(locales: readonly string[]): string | null {
  for (const locale of locales) {
    const region = locale.split("-").find((part, index) => index > 0 && /^[A-Za-z]{2}$/.test(part))
    const country = region?.toUpperCase()
    if (country && DIAL_COUNTRIES.some((item) => item.country === country)) return country
  }
  return null
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** Matches a country by any of its names without accents or hamza, by ISO code, or by calling code. */
export function matchesCountry(item: { country: string; code: string; names: string[] }, query: string): boolean {
  const q = fold(toLatinDigits(query).trim())
  const digits = q.match(/^(?:\+|00)?(\d+)$/)?.[1]
  if (digits) return item.code.startsWith(digits)
  return item.country.toLowerCase() === q || item.names.some((name) => fold(name).includes(q))
}

/** The digits to look a stored number up by: `06 12…`, `0033 6…` and `+33 6…` all find `+336…`. */
export const phoneSearchDigits = (query: string): string => toLatinDigits(query).replace(/\D/g, "").replace(/^0+/, "")
