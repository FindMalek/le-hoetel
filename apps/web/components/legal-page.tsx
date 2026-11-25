import { CONSENT_CHANNELS, CONSENT_WORDING_VERSION, consentWording, HOTEL_LANGUAGES } from "@ritorno/common"
import { localizedPath } from "@ritorno/i18n"
import { LocaleSwitcher } from "@ritorno/i18n/switcher"
import { ArrowLeftIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"

const PRIVACY = ["collect", "use", "consent", "rights", "keep"] as const
const TERMS = ["service", "duties", "pilot", "data", "end"] as const

export async function LegalPage({ page, withConsent }: { page: "privacy" | "terms"; withConsent?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations("legal"), getLocale()])
  const language = HOTEL_LANGUAGES.find((l) => l === locale) ?? "en"
  const sections =
    page === "privacy"
      ? PRIVACY.map((id) => ({ id, title: t(`privacy.sections.${id}.title`), body: t(`privacy.sections.${id}.body`) }))
      : TERMS.map((id) => ({ id, title: t(`terms.sections.${id}.title`), body: t(`terms.sections.${id}.body`) }))
  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-8 pb-16">
        <a
          href={localizedPath(language, "/")}
          className="inline-flex min-h-11 items-center gap-2 font-medium text-muted-foreground text-sm transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
          {SITE.name}
        </a>
        <header className="mt-8 grid gap-4 border-b pb-8">
          <p className="w-fit rounded-full border bg-muted px-3 py-1 text-muted-foreground text-xs">{t("updated")}</p>
          <h1 className="text-balance font-semibold text-h1 tracking-tight">{t(`${page}.title`)}</h1>
          <p className="max-w-[65ch] text-lg text-muted-foreground leading-relaxed">{t(`${page}.intro`)}</p>
        </header>
        <div className="divide-y">
          {sections.map(({ id, title, body }) => (
            <section key={id} className="grid gap-2 py-6 sm:grid-cols-[11rem_1fr] sm:gap-8">
              <h2 className="font-semibold text-balance">{title}</h2>
              <p className="max-w-[65ch] text-muted-foreground leading-7">{body}</p>
            </section>
          ))}
        </div>
        {withConsent && (
          <section className="mt-6 grid gap-4 rounded-xl border p-5">
            <div className="grid gap-1">
              <h2 className="font-semibold">{t("consentTitle")}</h2>
              <p className="text-muted-foreground text-sm tabular-nums">
                {t("consentVersion")}: <span dir="ltr">{CONSENT_WORDING_VERSION}</span>
              </p>
            </div>
            <ul className="grid gap-3">
              {CONSENT_CHANNELS.map((channel) => (
                <li key={channel} className="border-s-2 ps-4 text-muted-foreground text-sm leading-relaxed">
                  {consentWording(channel, language, t("hotel"))}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <footer className="border-t">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 text-sm">
          <nav className="flex gap-6 text-muted-foreground">
            <a href={localizedPath(language, "/privacy")} className="flex min-h-11 items-center hover:text-foreground">
              {t("privacy.title")}
            </a>
            <a href={localizedPath(language, "/terms")} className="flex min-h-11 items-center hover:text-foreground">
              {t("terms.title")}
            </a>
          </nav>
          <LocaleSwitcher mode="path" />
        </div>
      </footer>
    </>
  )
}
