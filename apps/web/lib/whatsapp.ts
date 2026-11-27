import { getTranslations } from "next-intl/server"

/** The landing's WhatsApp chat link with its prefilled text, `null` without a number. */
export async function whatsappContactUrl(number: string | undefined): Promise<string | null> {
  if (!number) return null
  const t = await getTranslations("landing.demo")
  return `https://wa.me/${number}?text=${encodeURIComponent(t("whatsappText"))}`
}
