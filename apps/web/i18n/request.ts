import { DEFAULT_LOCALE, getMessages, isLocale, LOCALE_HEADER } from "@le-hoetel/i18n"
import { headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

/** The public site takes its language from the url (or from an explicit `locale` passed to `getTranslations`, as the QR capture page does): `/fr/...` is rewritten by `proxy.ts` and carries `x-locale`. */
export default getRequestConfig(async ({ requestLocale }) => {
  const explicit = await requestLocale
  const requested = isLocale(explicit) ? explicit : (await headers()).get(LOCALE_HEADER)
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE
  return { locale, messages: getMessages(locale) }
})
