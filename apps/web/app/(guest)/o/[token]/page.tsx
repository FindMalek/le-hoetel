import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { CheckIcon, ClockIcon, GiftIcon, LinkIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { GuestState } from "@/components/guest-state"
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
  const validity = page.offer.validUntil
    ? t("validBetween", { from: day.format(page.offer.validFrom), until: day.format(page.offer.validUntil) })
    : t("validFrom", { from: day.format(page.offer.validFrom) })

  if (page.state !== "ready") {
    const icon = page.state === "redeemed" ? <CheckIcon /> : page.state === "notStarted" ? <ClockIcon /> : <GiftIcon />
    return (
      <GuestShell hotel={page.hotel} language={language}>
        <GuestState icon={icon} title={page.offer.title} body={t(`state.${page.state}`)}>
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
            <bdi>{page.offer.title}</bdi>
          </h2>
          {page.offer.text ? (
            <p className="text-pretty text-muted-foreground">
              <bdi>{page.offer.text}</bdi>
            </p>
          ) : null}
        </div>
        <div className="grid justify-items-center gap-4 rounded-card border p-5">
          {/* biome-ignore lint/performance/noImgElement: an inline svg made by the api for this code */}
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(page.qrSvg)}`}
            alt={t("qrAlt", { code: page.code })}
            className="aspect-square w-full max-w-60"
          />
          <p className="grid gap-1 text-center">
            <span className="text-muted-foreground text-small">{t("code")}</span>
            <bdi dir="ltr" className="font-mono font-semibold text-2xl tracking-widest">
              {page.code}
            </bdi>
          </p>
        </div>
        <div className="grid gap-1 text-center">
          <p>{t("show")}</p>
          <p className="text-caption text-muted-foreground">{validity}</p>
        </div>
      </div>
    </GuestShell>
  )
}
