import { formatTnd } from "@ritorno/common/pricing"
import { isForbidden } from "@ritorno/orpc/errors"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { WalletIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Usage" }

export default async function UsagePage() {
  await connection()
  const [t, locale] = await Promise.all([getTranslations("usage"), getLocale()])
  const balance = await call((api) => api.hotel.balance.get()).catch((error) => {
    if (isForbidden(error)) return null
    throw error
  })
  const money = (millimes: number) => formatTnd(millimes, locale)
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {!balance ? (
          <EmptyState icon={<WalletIcon />} title={t("forbidden")} />
        ) : (
          <>
            {balance.low ? <InlineAlert tone="warning">{t("low")}</InlineAlert> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatCard label={t("balance")} value={<span dir="ltr">{money(balance.balanceMillimes)}</span>} />
              <StatCard
                label={t("month")}
                value={<span dir="ltr">{money(balance.monthSpentMillimes)}</span>}
                hint={t("monthMessages", { count: balance.monthMessages })}
              />
            </div>
            <section className="flex flex-col gap-3">
              <h2 className="font-heading font-semibold text-base">{t("history")}</h2>
              {balance.entries.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("empty")}</p>
              ) : (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {balance.entries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 p-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-sm">{t(`kinds.${entry.kind}`)}</span>
                        <span className="text-muted-foreground text-xs">
                          <LocalDate value={entry.createdAt} time />
                        </span>
                      </span>
                      <span className="font-medium text-sm tabular-nums" dir="ltr">
                        {entry.amountMillimes > 0 ? "+" : ""}
                        {money(entry.amountMillimes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
