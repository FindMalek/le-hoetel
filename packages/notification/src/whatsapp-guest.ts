import { unsubscribeFooter } from "@le-hoetel/common/unsubscribe"
import type { Locale } from "@le-hoetel/i18n/config"
import { type EmailProps, HOTEL_EMAIL_KEYS, type HotelEmailKey } from "./hotel-email"

export const WHATSAPP_GUEST_KEYS = HOTEL_EMAIL_KEYS

export interface GuestWhatsAppTemplate {
  /** The template name in Meta. One name carries the en, fr and ar translations. */
  name: string
  /** Named variables, in the order the body uses them. */
  params: readonly string[]
  /** What the variables look like in the Meta review. */
  examples: Record<string, string>
  body: Record<Locale, string>
}

/** The texts submitted to Meta (`pnpm --filter @le-hoetel/notification whatsapp:setup`) and published in `whatsapp-templates.mdx`. */
export const GUEST_WHATSAPP_TEMPLATES: Record<HotelEmailKey, GuestWhatsAppTemplate> = {
  welcome: {
    name: "guest_welcome",
    params: ["guest_name", "hotel_name"],
    examples: { guest_name: "Amel", hotel_name: "Dar Amel" },
    body: {
      en: "Hello {{guest_name}}, welcome to {{hotel_name}}. We are glad to have you with us and we are here if you need anything during your stay.",
      fr: "Bonjour {{guest_name}}, bienvenue à {{hotel_name}}. Nous sommes ravis de vous accueillir et restons à votre disposition pendant votre séjour.",
      ar: "مرحبًا {{guest_name}}، أهلًا بك في {{hotel_name}}. يسعدنا استقبالك ونحن في خدمتك طوال مدة إقامتك.",
    },
  },
  birthday: {
    name: "guest_birthday",
    params: ["guest_name", "hotel_name", "offer"],
    examples: { guest_name: "Amel", hotel_name: "Dar Amel", offer: "a free dessert at dinner" },
    body: {
      en: "Happy birthday {{guest_name}}! {{hotel_name}} has a gift for you: {{offer}}. Show this message at the front desk to enjoy it.",
      fr: "Joyeux anniversaire {{guest_name}} ! {{hotel_name}} a un cadeau pour vous : {{offer}}. Présentez ce message à la réception pour en profiter.",
      ar: "عيد ميلاد سعيد {{guest_name}}! يقدم لك {{hotel_name}} هدية: {{offer}}. أظهر هذه الرسالة في الاستقبال للاستفادة منها.",
    },
  },
  survey: {
    name: "guest_survey",
    params: ["guest_name", "hotel_name", "link"],
    examples: { guest_name: "Amel", hotel_name: "Dar Amel", link: "https://le-hoetel.com/s/abc123" },
    body: {
      en: "Hello {{guest_name}}, thank you for staying at {{hotel_name}}. How was your stay? Tell us in one minute: {{link}} Your answer helps us improve.",
      fr: "Bonjour {{guest_name}}, merci d'avoir séjourné à {{hotel_name}}. Comment s'est passé votre séjour ? Répondez en une minute : {{link}} Votre avis nous aide à nous améliorer.",
      ar: "مرحبًا {{guest_name}}، شكرًا لإقامتك في {{hotel_name}}. كيف كانت إقامتك؟ شاركنا رأيك في دقيقة: {{link}} رأيك يساعدنا على التحسن.",
    },
  },
  reminder: {
    name: "guest_reminder",
    params: ["guest_name", "hotel_name", "offer"],
    examples: { guest_name: "Amel", hotel_name: "Dar Amel", offer: "a free dessert at dinner" },
    body: {
      en: "Hello {{guest_name}}, a reminder from {{hotel_name}}: your offer {{offer}} is still waiting for you. Show this message at the front desk to use it.",
      fr: "Bonjour {{guest_name}}, un rappel de {{hotel_name}} : votre offre {{offer}} vous attend toujours. Présentez ce message à la réception pour en profiter.",
      ar: "مرحبًا {{guest_name}}، تذكير من {{hotel_name}}: عرضك {{offer}} ما زال بانتظارك. أظهر هذه الرسالة في الاستقبال للاستفادة منه.",
    },
  },
  message: {
    name: "guest_message",
    params: ["guest_name", "hotel_name", "text"],
    examples: { guest_name: "Amel", hotel_name: "Dar Amel", text: "Happy Eid from all of us." },
    body: {
      en: "Hello {{guest_name}}, a message from {{hotel_name}}: {{text}}",
      fr: "Bonjour {{guest_name}}, un message de {{hotel_name}} : {{text}}",
      ar: "مرحبًا {{guest_name}}، رسالة من {{hotel_name}}: {{text}}",
    },
  },
}

/** The footer of every template: the STOP line, fixed text because Meta footers take no variables. */
export const guestTemplateFooter = (language: Locale): string => unsubscribeFooter("whatsapp", language, "")

/** Meta rejects line breaks, tabs and long runs of spaces inside a variable. */
const clean = (value: string): string => value.replace(/\s+/g, " ").trim()

function required(value: string | undefined | null, code: string): string {
  const text = value ? clean(value) : ""
  if (!text) throw Object.assign(new Error(`WhatsApp template needs ${code}.`), { code })
  return text
}

/** The variables of one template, from the same props the email uses. A missing offer or link fails the message instead of sending an empty variable. */
export function guestTemplateParams<Key extends HotelEmailKey>(
  key: Key,
  { guestName, hotelName, props }: { guestName: string; hotelName: string; props: EmailProps[Key] },
): Record<string, string> {
  const base = { guest_name: required(guestName, "missing_name"), hotel_name: required(hotelName, "missing_hotel") }
  const { offer, ctaUrl, body } = props as { offer?: { title: string }; ctaUrl?: string; body?: string }
  if (key === "birthday" || key === "reminder") return { ...base, offer: required(offer?.title, "missing_offer") }
  if (key === "survey") return { ...base, link: required(ctaUrl, "missing_link") }
  if (key === "message") return { ...base, text: required(body, "missing_text") }
  return base
}
