import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { formatDate } from "@ritorno/ui/lib/date"
import { MessageCircleIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { InboxTabs } from "@/components/inbox-tabs"
import { PageHeader } from "@/components/page-header"
import { WhatsAppScanRemove } from "@/components/whatsapp-scan-remove"
import { call } from "@/lib/api"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav")
  return { title: t("whatsappScans") }
}

export default async function WhatsAppScansPage() {
  const [t, tInbox, locale, { activeId }] = await Promise.all([
    getTranslations("whatsappScans"),
    getTranslations("inbox"),
    getLocale(),
    call((api) => api.hotel.mine()),
  ])
  const empty = (
    <PageState kind="empty" icon={<MessageCircleIcon />} title={t("emptyTitle")} description={t("emptyBody")} />
  )
  const [scans, hotel] = activeId
    ? await Promise.all([call((api) => api.whatsappScans.list()), call((api) => api.hotel.get())])
    : [[], null]

  return (
    <>
      <PageHeader title={tInbox("title")} description={t("description")} />
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <InboxTabs current="/whatsapp" />
        <p className="max-w-prose text-muted-foreground text-small">{t("notice")}</p>
        {scans.length && hotel ? (
          <ul className="flex flex-col divide-y rounded-card border bg-card">
            {scans.map((scan) => {
              const phone = <bdi dir="ltr">{scan.phoneE164}</bdi>
              const who = scan.guestName ?? scan.phoneE164
              return (
                <li key={scan.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4 md:px-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {scan.guestId ? (
                      <Link
                        href={`/guests/${scan.guestId}`}
                        className="w-fit font-medium text-small underline-offset-4 hover:underline"
                      >
                        <bdi>{scan.guestName}</bdi>
                      </Link>
                    ) : (
                      <span className="font-medium text-small">{phone}</span>
                    )}
                    <p className="text-muted-foreground text-small">
                      {t(`spot.${scan.spot}`)} {scan.location ? <bdi>{scan.location}</bdi> : null}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {scan.guestId ? <>{phone} · </> : null}
                      {formatDate(scan.lastScanAt, locale, hotel.timezone)} · <bdi>{scan.language.toUpperCase()}</bdi>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="min-h-11 max-md:flex-1"
                      nativeButton={false}
                      render={
                        <a
                          href={`https://wa.me/${scan.phoneE164.slice(1)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={t("replyTo", { guest: who })}
                        />
                      }
                    >
                      <MessageCircleIcon data-icon="inline-start" aria-hidden />
                      {t("reply")}
                    </Button>
                    <WhatsAppScanRemove id={scan.id} guest={who} />
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          empty
        )}
      </div>
    </>
  )
}
