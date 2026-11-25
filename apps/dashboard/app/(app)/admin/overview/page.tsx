import { Button } from "@ritorno/ui/components/button"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { Section } from "@ritorno/ui/components/section"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { BuildingIcon, PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import type { CSSProperties } from "react"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Platform overview" }

export default async function AdminOverviewPage() {
  const [t, { hotels, guests, messages }] = await Promise.all([
    getTranslations("adminOverview"),
    call((api) => api.admin.hotels.overview()),
  ])
  const rate = guests.total ? Math.round((guests.consented / guests.total) * 100) : null
  const funnel = [
    { key: "created", value: hotels.total },
    { key: "owner", value: hotels.withOwner },
    { key: "guests", value: hotels.withGuests },
  ] as const

  if (hotels.total === 0)
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <div className="p-4 md:p-6">
          <EmptyState
            decorated
            icon={<BuildingIcon />}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <Button render={<Link href="/admin/hotels/new" />} nativeButton={false}>
                <PlusIcon data-icon="inline-start" />
                {t("empty.action")}
              </Button>
            }
          />
        </div>
      </>
    )

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("stats.hotels")}
            value={hotels.total}
            hint={t("stats.hotelsHint", { pilot: hotels.pilot, active: hotels.active })}
          />
          <StatCard
            label={t("stats.guests")}
            value={guests.total}
            hint={t("stats.guestsHint", { count: guests.last7Days })}
          />
          <StatCard
            label={t("stats.consent")}
            value={rate === null ? "–" : `${rate}%`}
            hint={t("stats.consentHint", { count: guests.consented })}
          />
          <StatCard
            label={t("stats.messages")}
            value={messages.total}
            hint={t("stats.messagesHint", { delivered: messages.delivered, failed: messages.failed })}
          />
        </div>

        <Section title={t("funnel.title")} description={t("funnel.description")}>
          <ol className="flex flex-col gap-4">
            {funnel.map((step) => (
              <li key={step.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{t(`funnel.${step.key}`)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {step.value} / {hotels.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-full w-(--bar) rounded-full bg-primary"
                    style={{ "--bar": `${(step.value / hotels.total) * 100}%` } as CSSProperties}
                  />
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          title={t("attention.title")}
          actions={
            <Button variant="outline" render={<Link href="/admin/hotels" />} nativeButton={false}>
              {t("attention.all")}
            </Button>
          }
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <dt className="text-muted-foreground text-sm">{t("attention.pilots")}</dt>
              <dd className="font-heading font-semibold text-2xl tabular-nums">{hotels.pilotsEndingSoon}</dd>
            </div>
            <div className="rounded-lg border p-4">
              <dt className="text-muted-foreground text-sm">{t("attention.suspended")}</dt>
              <dd className="font-heading font-semibold text-2xl tabular-nums">{hotels.suspended}</dd>
            </div>
          </dl>
        </Section>
      </div>
    </>
  )
}
