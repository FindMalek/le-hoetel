import { Button } from "@ritorno/ui/components/button"
import { Num } from "@ritorno/ui/components/num"
import { PageState } from "@ritorno/ui/components/page-state"
import { Section } from "@ritorno/ui/components/section"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { formatNumber } from "@ritorno/ui/lib/number"
import { BuildingIcon, MessageCircleIcon, PlusIcon, UsersIcon, WalletIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import type { CSSProperties } from "react"
import { AdminAttention } from "@/components/admin-attention"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Platform overview" }

export default async function AdminOverviewPage() {
  const [t, locale, { hotels, guests, messages, lowBalance }, list] = await Promise.all([
    getTranslations("adminOverview"),
    getLocale(),
    call((api) => api.admin.hotels.overview()),
    call((api) => api.admin.hotels.list()),
  ])
  const count = (value: number) => formatNumber(value, locale)
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
          <PageState
            kind="empty"
            firstRun
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
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <StatCard
            label={t("stats.hotels")}
            icon={<BuildingIcon />}
            value={count(hotels.total)}
            hint={t("stats.hotelsHint", {
              pilot: count(hotels.pilot),
              active: count(hotels.active),
              suspended: count(hotels.suspended),
            })}
          />
          <StatCard
            label={t("stats.guests")}
            icon={<UsersIcon />}
            value={count(guests.total)}
            hint={t("stats.guestsHint", { count: guests.last7Days })}
          />
          <StatCard
            label={t("stats.messages")}
            icon={<MessageCircleIcon />}
            value={count(messages.total)}
            hint={t("stats.messagesHint", { delivered: count(messages.delivered), failed: count(messages.failed) })}
          />
          <StatCard
            label={t("stats.lowBalance")}
            icon={<WalletIcon />}
            value={count(lowBalance.length)}
            hint={t("stats.lowBalanceHint")}
          />
        </div>

        <Section
          title={t("attention.title")}
          description={t("attention.description")}
          actions={
            <Button variant="outline" render={<Link href="/admin/hotels" />} nativeButton={false}>
              {t("attention.all")}
            </Button>
          }
        >
          <AdminAttention hotels={list} lowBalance={lowBalance} now={new Date()} />
        </Section>

        <Section title={t("funnel.title")} description={t("funnel.description")}>
          <ol className="flex flex-col gap-4">
            {funnel.map((step) => (
              <li key={step.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{t(`funnel.${step.key}`)}</span>
                  <span className="text-muted-foreground tabular-nums">
                    <Num value={`${step.value} / ${hotels.total}`} />
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
      </div>
    </>
  )
}
