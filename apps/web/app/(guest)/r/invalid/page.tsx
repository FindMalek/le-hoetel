import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { LinkIcon } from "lucide-react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { GuestState } from "@/components/guest-state"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function Page({ searchParams }: PageProps<"/r/invalid">) {
  const { lang } = await searchParams
  const language = guestLanguage(lang, guestLanguage(await getLocale(), DEFAULT_LOCALE))
  const t = await getTranslations({ locale: language, namespace: "guest" })
  return (
    <GuestShell hotel={null} language={language}>
      <GuestState heading="h1" icon={<LinkIcon />} title={t("reviewInvalidTitle")} body={t("reviewInvalid")} />
    </GuestShell>
  )
}
