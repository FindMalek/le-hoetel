import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import { getTranslations } from "next-intl/server"
import type { PreviewCopies } from "@/components/brand-preview"
import type { OfferPreviewCopies } from "@/components/offer-card-preview"

/** The guest facing words of the branding preview, one set per language the hotel can pick. Raw, so the preview fills in the live hotel name. */
export async function getPreviewCopies(): Promise<PreviewCopies> {
  const entries = await Promise.all(
    HOTEL_LANGUAGES.map(async (locale) => {
      const [capture, settings] = await Promise.all([
        getTranslations({ locale, namespace: "capture" }),
        getTranslations({ locale, namespace: "hotelSettings.preview" }),
      ])
      const raw = (t: typeof capture, key: string) => String(t.raw(key))
      return [
        locale,
        {
          welcome: raw(capture, "welcome"),
          intro: raw(capture, "intro"),
          name: raw(capture, "name"),
          phone: raw(capture, "phone"),
          submit: raw(capture, "submit"),
          sample: raw(settings, "sample"),
          emailTitle: raw(settings, "emailTitle"),
          emailBody: raw(settings, "emailBody"),
          emailCta: raw(settings, "emailCta"),
          emailFooter: raw(settings, "emailFooter"),
          unsubscribe: raw(settings, "unsubscribe"),
        },
      ] as const
    }),
  )
  return Object.fromEntries(entries) as PreviewCopies
}

/** The words of the guest's offer page in each language. */
export async function getOfferPreviewCopies(): Promise<OfferPreviewCopies> {
  const entries = await Promise.all(
    HOTEL_LANGUAGES.map(async (locale) => {
      const t = await getTranslations({ locale, namespace: "offer" })
      const raw = (key: string) => String(t.raw(key))
      return [
        locale,
        {
          ready: raw("state.ready"),
          code: raw("code"),
          show: raw("show"),
          validFrom: raw("validFrom"),
          validBetween: raw("validBetween"),
        },
      ] as const
    }),
  )
  return Object.fromEntries(entries) as OfferPreviewCopies
}
