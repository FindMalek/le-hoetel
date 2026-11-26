import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { getLocale, getTranslations } from "next-intl/server"
import { type GuestErrorCopy, GuestErrorProvider } from "@/components/guest-error"
import { guestLanguage } from "@/components/guest-shell"

/** The error boundary is a client component and runs before the page knows the guest's language, so it gets its few strings in every language. */
export default async function GuestLayout({ children }: { children: React.ReactNode }) {
  const entries = await Promise.all(
    HOTEL_LANGUAGES.map(async (locale) => {
      const t = await getTranslations({ locale, namespace: "guest" })
      return [locale, { title: t("errorTitle"), body: t("errorBody"), retry: t("retry") }] as const
    }),
  )
  const copy = Object.fromEntries(entries) as GuestErrorCopy
  return (
    <GuestErrorProvider copy={copy} fallback={guestLanguage(await getLocale(), DEFAULT_LOCALE)}>
      {children}
    </GuestErrorProvider>
  )
}
