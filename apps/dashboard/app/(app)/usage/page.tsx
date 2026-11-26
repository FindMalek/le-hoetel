import { formatTnd, LOW_BALANCE_MILLIMES } from "@ritorno/common/pricing"
import { isForbidden } from "@ritorno/orpc/errors"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Num } from "@ritorno/ui/components/num"
import { PageState } from "@ritorno/ui/components/page-state"
import { Section } from "@ritorno/ui/components/section"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { MessageCircleIcon, ReceiptIcon, WalletIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Usage" }

const ENTRY_TONES = { top_up: "success", usage: "neutral", refund: "info" } as const

export default async function UsagePage() {
  await connection()
  const [t, locale] = await Promise.all([getTranslations("usage"), getLocale()])
  const forbidden = (error: unknown) => {
    if (isForbidden(error)) return null
    throw error
  }
  const [balance, hotel] = await Promise.all([
    call((api) => api.hotel.balance.get()).catch(forbidden),
    call((api) => api.hotel.get()).catch(forbidden),
  ])
  const money = (millimes: number) => <Num value={formatTnd(millimes, locale)} />
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex max-w-4xl flex-col gap-8 p-4 md:p-6">
        {!balance ? (
          <PageState kind="forbidden" icon={<WalletIcon />} title={t("forbidden")} />
        ) : (
          <>
            {balance.low ? (
              <InlineAlert tone="warning" title={t("lowTitle")}>
                {t.rich("low", { min: () => money(LOW_BALANCE_MILLIMES) })}
              </InlineAlert>
            ) : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard
                label={t("balance")}
                icon={<WalletIcon />}
                value={money(balance.balanceMillimes)}
                hint={
                  balance.low ? (
                    <StatusBadge tone="warning">{t("lowBadge")}</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">{t("okBadge")}</StatusBadge>
                  )
                }
              />
              <StatCard
                label={t("month")}
                icon={<MessageCircleIcon />}
                value={money(balance.monthSpentMillimes)}
                hint={t("monthMessages", { count: balance.monthMessages })}
              />
            </div>
            <Section title={t("history")} description={t("historyHint")}>
              {balance.entries.length === 0 ? (
                <PageState kind="empty" icon={<ReceiptIcon />} title={t("empty")} />
              ) : (
                <ul className="flex flex-col divide-y rounded-xl border bg-card">
                  {balance.entries.map((entry) => (
                    <li key={entry.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={ENTRY_TONES[entry.kind]} icon={null}>
                            {t(`kinds.${entry.kind}`)}
                          </StatusBadge>
                        </span>
                        <time
                          dateTime={entry.createdAt.toISOString()}
                          className="text-muted-foreground text-sm tabular-nums"
                        >
                          {formatDate(entry.createdAt, locale, hotel?.timezone)}
                        </time>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        <Num
                          value={`${entry.amountMillimes > 0 ? "+" : ""}${formatTnd(entry.amountMillimes, locale)}`}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </div>
    </>
  )
}
