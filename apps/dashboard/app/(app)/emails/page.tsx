import { isLocale } from "@le-hoetel/i18n/config"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { EmailPreview } from "@/components/email-preview"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Emails" }

export default async function EmailsPage() {
  const [t, hotel] = await Promise.all([getTranslations("emails"), call((api) => api.hotel.get()).catch(() => null)])
  const defaultLanguage = isLocale(hotel?.defaultLanguage) ? hotel.defaultLanguage : "fr"
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-4 p-4 md:p-6">
        {hotel ? (
          <EmailPreview
            defaultLanguage={defaultLanguage}
            labels={{
              template: t("template"),
              language: t("language"),
              appearance: t("appearance"),
              width: t("width"),
              light: t("light"),
              dark: t("dark"),
              desktop: t("desktop"),
              mobile: t("mobile"),
              sendTest: t("sendTest"),
              sending: t("sending"),
              sentTo: t("sentTo", { email: "{email}" }),
              notSent: t("notSent"),
              loading: t("loading"),
              subject: t("subject"),
              frameTitle: t("frameTitle"),
              templates: {
                welcome: t("templates.welcome"),
                birthday: t("templates.birthday"),
                survey: t("templates.survey"),
                reminder: t("templates.reminder"),
              },
              languages: { en: t("languages.en"), fr: t("languages.fr"), ar: t("languages.ar") },
            }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{t("noHotel")}</p>
        )}
      </div>
    </>
  )
}
