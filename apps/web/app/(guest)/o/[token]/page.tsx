import { localizedOffer } from "@ritorno/common/offers"
import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { CheckIcon, ClockIcon, GiftIcon, LinkIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { GuestState } from "@/components/guest-state"
import { OfferCodeCard } from "@/components/offer-code-card"
import { getOfferPage } from "@/lib/api"

export const metadata: Metadata = {
  title: "Offer",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long", timeZone: "Africa/Tunis" }

export default async function Page({ params, searchParams }: PageProps<"/o/[token]">) {
  await connection()
  const [{ token }, { lang }] = await Promise.all([params, searchParams])
  const page = await getOfferPage(token)

  if (!page) {
    const language = guestLanguage(lang, guestLanguage(await getLocale(), DEFAULT_LOCALE))
    const t = await getTranslations({ locale: language, namespace: "offer" })
    return (
      <GuestShell hotel={null} language={language}>
        <GuestState heading="h1" icon={<LinkIcon />} title={t("invalidTitle")} body={t("invalid")} />
      </GuestShell>
    )
  }

  const language = guestLanguage(lang, page.language)
  const t = await getTranslations({ locale: language, namespace: "offer" })
  const day = new Intl.DateTimeFormat(language, DAY_FORMAT)
  const words = localizedOffer(page.offer, language)
  const validity = page.offer.validUntil
    ? t("validBetween", { from: day.format(page.offer.validFrom), until: day.format(page.offer.validUntil) })
    : t("validFrom", { from: day.format(page.offer.validFrom) })

  if (page.state !== "ready") {
    const icon = page.state === "redeemed" ? <CheckIcon /> : page.state === "notStarted" ? <ClockIcon /> : <GiftIcon />
    return (
      <GuestShell hotel={page.hotel} language={language}>
        <GuestState icon={icon} title={words.title} body={t(`state.${page.state}`)}>
          <p className="text-caption text-muted-foreground">{validity}</p>
        </GuestState>
      </GuestShell>
    )
  }

  return (
    <GuestShell hotel={page.hotel} language={language}>
      <div className="grid gap-6 pb-6">
        <div className="grid justify-items-start gap-3">
          <StatusBadge tone="success">{t("state.ready")}</StatusBadge>
          <h2 className="text-balance font-semibold text-h3 tracking-tight">
            <bdi>{words.title}</bdi>
          </h2>
          {words.text ? (
            <p className="text-pretty text-muted-foreground">
              <bdi>{words.text}</bdi>
            </p>
          ) : null}
        </div>
        <OfferCodeCard code={page.code} qrSvg={page.qrSvg} label={t("code")} qrAlt={t("qrAlt", { code: page.code })} />
        <div className="grid gap-1 text-center">
          <p>{t("show")}</p>
          <p className="text-caption text-muted-foreground">{validity}</p>
        </div>
      </div>
    </GuestShell>
  )
}
