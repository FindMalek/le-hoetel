import { createHmac, timingSafeEqual } from "node:crypto"
import { TOKEN_NAMESPACE } from "./constants"
import { HOTEL_LANGUAGES, type HotelLanguage } from "./hotel"
import { CAPTURE_LOCATION_MAX, CAPTURE_SOURCES, type CaptureSource } from "./schemas/capture"
import { unsubscribeFooter } from "./unsubscribe"

/** How long a scan is kept for the staff list. */
export const WHATSAPP_SCAN_RETENTION_DAYS = 30

export interface ScanSpot {
  slug: string
  source: CaptureSource
  language: HotelLanguage
  location: string | null
}

const CODE = /\bh1-([A-Za-z0-9_-]{1,400})\.([A-Za-z0-9_-]{16})/

const sign = (secret: string, payload: string): Buffer => {
  const key = createHmac("sha256", secret).update(`${TOKEN_NAMESPACE}:whatsapp-scan:v1`).digest()
  return createHmac("sha256", key).update(payload).digest().subarray(0, 12)
}

/** The spot comes from the page url, so anyone can choose it: drop control and bidi characters before it reaches staff. */
const cleanLocation = (location: string | null | undefined): string | null =>
  location?.replace(/\p{C}/gu, "").trim().slice(0, CAPTURE_LOCATION_MAX) || null

/** Hotel, spot and language in one signed token: nothing to store, and a made up or edited code is ignored. */
export function signScanCode(secret: string, spot: ScanSpot): string {
  const payload = [spot.slug, spot.source, spot.language, cleanLocation(spot.location) ?? ""].join("|")
  return `h1-${Buffer.from(payload, "utf8").toString("base64url")}.${sign(secret, payload).toString("base64url")}`
}

/** The spot behind the first code in a message this server signed, or null. */
export function readScanCode(secret: string, text: string): ScanSpot | null {
  const [, body, signature] = CODE.exec(text) ?? []
  if (!body || !signature) return null
  const payload = Buffer.from(body, "base64url").toString("utf8")
  const given = Buffer.from(signature, "base64url")
  const expected = sign(secret, payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const [slug, source, language, ...location] = payload.split("|")
  const known = HOTEL_LANGUAGES.find((value) => value === language)
  if (!slug || !source || !(source in CAPTURE_SOURCES) || !known) return null
  return { slug, source: source as CaptureSource, language: known, location: location.join("|") || null }
}

const PREFILL: Record<HotelLanguage, string> = {
  en: "Hello {hotel}! (ref: {code})",
  fr: "Bonjour {hotel} ! (réf : {code})",
  ar: "مرحبًا {hotel}! (الرمز: {code})",
}

/** The wa.me link of the shared business number, with the message the guest only has to send. */
export function scanLink(number: string, hotelName: string, language: HotelLanguage, code: string): string {
  const text = PREFILL[language].replace("{code}", code).replace("{hotel}", () => hotelName)
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}

interface Welcome {
  welcome: string
  perk: string
  register: string
  team: string
}

const WELCOMES: Record<HotelLanguage, Welcome> = {
  en: {
    welcome: "Welcome to {hotel}!",
    perk: "A small gift from {hotel} is waiting for you at the front desk.",
    register: "Join here: {url}",
    team: "The hotel team can see your message and your number, and may answer from their own WhatsApp. Ritorno sends this reply for {hotel}.",
  },
  fr: {
    welcome: "Bienvenue à {hotel} !",
    perk: "Un petit cadeau de {hotel} vous attend à la réception.",
    register: "Inscrivez-vous ici : {url}",
    team: "L'équipe de l'hôtel voit votre message et votre numéro, et peut vous répondre depuis son propre WhatsApp. Ritorno envoie cette réponse pour {hotel}.",
  },
  ar: {
    welcome: "مرحبًا بكم في {hotel}!",
    perk: "هدية صغيرة من {hotel} في انتظاركم في الاستقبال.",
    register: "سجّلوا من هنا: {url}",
    team: "يرى فريق الفندق رسالتكم ورقمكم، وقد يرد عليكم من واتساب الخاص به. ترسل Ritorno هذا الرد نيابة عن {hotel}.",
  },
}

/** The one scripted reply to a scan. `registerUrl` null means the guest already signed up with this hotel. */
export function scanWelcome(input: {
  language: HotelLanguage
  hotelName: string
  offer: { title: string; text: string | null } | null
  registerUrl: string | null
}): string {
  const copy = WELCOMES[input.language]
  const fill = (line: string) => line.replace("{hotel}", () => input.hotelName)
  const perk = input.offer ? [input.offer.title, input.offer.text].filter(Boolean).join("\n") : fill(copy.perk)
  return [
    fill(copy.welcome),
    perk,
    input.registerUrl && copy.register.replace("{url}", () => input.registerUrl ?? ""),
    fill(copy.team),
    unsubscribeFooter("whatsapp", input.language, ""),
  ]
    .filter(Boolean)
    .join("\n\n")
}

const NOTICES: Record<HotelLanguage, { title: string; room: string; table: string; desk: string }> = {
  en: { title: "A guest wrote to {hotel} on WhatsApp", room: "Room", table: "Table", desk: "Front desk" },
  fr: { title: "Un client a écrit à {hotel} sur WhatsApp", room: "Chambre", table: "Table", desk: "Réception" },
  ar: { title: "راسل أحد الضيوف {hotel} على واتساب", room: "الغرفة", table: "الطاولة", desk: "الاستقبال" },
}

/** The staff notification of a scan: hotel and spot only, never the guest. */
export function scanNotice(language: HotelLanguage, hotelName: string, source: CaptureSource, location: string | null) {
  const copy = NOTICES[language]
  return {
    title: copy.title.replace("{hotel}", () => hotelName),
    body: [copy[source], location].filter(Boolean).join(" "),
  }
}
