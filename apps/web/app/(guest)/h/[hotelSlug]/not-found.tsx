import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { QrCodeIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { GuestState } from "@/components/guest-state"

export default async function HotelNotFound() {
  const language = guestLanguage(await getLocale(), DEFAULT_LOCALE)
  const t = await getTranslations({ locale: language, namespace: "guest" })
  return (
    <GuestShell hotel={null} language={language} languageHref={null}>
      <GuestState heading="h1" icon={<QrCodeIcon />} title={t("hotelMissingTitle")} body={t("hotelMissing")} />
    </GuestShell>
  )
}
