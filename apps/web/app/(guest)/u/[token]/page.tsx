import { consentWording } from "@ritorno/common/consent"
import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { LinkIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { GuestState } from "@/components/guest-state"
import { getUnsubscribePage } from "@/lib/api"
import { UnsubscribeForm } from "./unsubscribe-form"

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function Page({ params, searchParams }: PageProps<"/u/[token]">) {
  await connection()
  const [{ token }, { lang }] = await Promise.all([params, searchParams])
  const page = await getUnsubscribePage(token)

  if (!page) {
    const language = guestLanguage(lang, guestLanguage(await getLocale(), DEFAULT_LOCALE))
    const t = await getTranslations({ locale: language, namespace: "unsubscribe" })
    return (
      <GuestShell hotel={null} language={language}>
        <GuestState heading="h1" icon={<LinkIcon />} title={t("invalidTitle")} body={t("invalid")} />
      </GuestShell>
    )
  }

  // The consent log stores the wording in the guest's language, so the page cannot offer another one.
  const language = page.language
  const t = await getTranslations({ locale: language, namespace: "unsubscribe" })
  const hotel = page.hotel.displayName
  return (
    <GuestShell hotel={page.hotel} language={language} languageHref={null}>
      <div className="grid gap-6 pb-6">
        <div className="grid gap-2">
          <h2 className="text-balance font-semibold text-h3 tracking-tight">{t("title", { hotel })}</h2>
          <p className="text-muted-foreground leading-relaxed">{t("intro", { hotel })}</p>
        </div>
        <UnsubscribeForm
          token={token}
          initial={page.channels}
          wording={Object.fromEntries(
            page.channels.map(({ channel }) => [channel, consentWording(channel, language, hotel)]),
          )}
          copy={{
            email: t("email"),
            whatsapp: t("whatsapp"),
            turnsOn: t("consentOn", { wording: "{wording}" }),
            stopAll: t("stopAll"),
            stoppedTitle: t("stoppedTitle"),
            stopped: t("stopped", { hotel }),
            saved: t("saved"),
            error: t("error"),
          }}
        />
      </div>
    </GuestShell>
  )
}
