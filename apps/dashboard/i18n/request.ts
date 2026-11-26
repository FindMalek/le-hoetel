import { getMessages, isLocale, LOCALE_COOKIE, negotiateLocale } from "@ritorno/i18n"
import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

/** The dashboard is private, so its language is a preference: the switcher's cookie, else the browser's. */
// An explicit `getTranslations({ locale })` (the guest page preview, in the guest's language) wins over the preference.
export default getRequestConfig(async ({ locale: requested }) => {
  if (isLocale(requested)) return { locale: requested, messages: getMessages(requested) }
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(saved) ? saved : negotiateLocale((await headers()).get("accept-language"))
  return { locale, messages: getMessages(locale) }
})
