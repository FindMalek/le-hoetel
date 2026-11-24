import { CONSENT_CHANNELS, CONSENT_WORDING_VERSION, consentWording, HOTEL_LANGUAGES } from "@le-hoetel/common"
import { getLocale, getTranslations } from "next-intl/server"

export async function LegalPage({ page, withConsent }: { page: "privacy" | "terms"; withConsent?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("legal"), getLocale()])
  const language = HOTEL_LANGUAGES.find((l) => l === locale) ?? "en"
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="font-heading font-semibold text-3xl">{t(`${page}.title`)}</h1>
      <p className="mt-2 text-muted-foreground text-sm">{t("updated")}</p>
      <p className="mt-4 text-muted-foreground">{t(`${page}.intro`)}</p>
      {withConsent && (
        <section className="mt-10">
          <h2 className="font-heading font-semibold text-xl">{t("consentTitle")}</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {t("consentVersion")}: {CONSENT_WORDING_VERSION}
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {CONSENT_CHANNELS.map((channel) => (
              <li key={channel} className="border p-3 text-sm">
                {consentWording(channel, language, t("hotel"))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
