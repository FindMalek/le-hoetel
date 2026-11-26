import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { buttonVariants } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { QrCodeIcon } from "lucide-react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { GuestState } from "@/components/guest-state"

export const metadata: Metadata = { robots: { index: false, follow: false } }

// i18n-used: guest.codeMissingTitle
// i18n-used: guest.codeMissing
/** Where `/q/<code>` lands when it cannot go on: an unknown code, or with `?retry=<code>` one that did not load. */
export default async function Page({ searchParams }: PageProps<"/q/invalid">) {
  const { lang, retry } = await searchParams
  const language = guestLanguage(lang, guestLanguage(await getLocale(), DEFAULT_LOCALE))
  const t = await getTranslations({ locale: language, namespace: "guest" })
  const again = typeof retry === "string" ? retry : null
  return (
    <GuestShell
      hotel={null}
      language={language}
      // switching language must not turn "try again" into "wrong code"
      languageHref={(to) => `?${new URLSearchParams({ lang: to, ...(again ? { retry: again } : {}) })}`}
    >
      <GuestState
        heading="h1"
        icon={<QrCodeIcon />}
        title={t(again ? "errorTitle" : "codeMissingTitle")}
        body={t(again ? "errorBody" : "codeMissing")}
      />
      {again ? (
        <a
          href={`/q/${encodeURIComponent(again)}?lang=${language}`}
          className={cn(buttonVariants({ size: "lg" }), "min-h-touch w-full")}
        >
          {t("retry")}
        </a>
      ) : null}
    </GuestShell>
  )
}
