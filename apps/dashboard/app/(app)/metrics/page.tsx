import { isForbidden } from "@le-hoetel/orpc/errors"
import { Button } from "@le-hoetel/ui/components/button"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { Section } from "@le-hoetel/ui/components/section"
import { StatCard } from "@le-hoetel/ui/components/stat-card"
import { ChartColumnIcon, GiftIcon, SendIcon, ShieldCheckIcon, StarIcon, UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { CapturedChart } from "@/components/captured-chart"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Metrics" }

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]

const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–")

export default async function MetricsPage({ searchParams }: PageProps<"/metrics">) {
  await connection()
  const raw = (await searchParams).days
  const asked = Number(Array.isArray(raw) ? raw[0] : raw)
  const days: Period = PERIODS.find((period) => period === asked) ?? 30
  const t = await getTranslations("metrics")
  const data = await call((api) => api.metrics.get({ days })).catch((error) => {
    if (isForbidden(error)) return null
    throw error
  })

  const switcher = (
    <nav aria-label={t("periodLabel")} className="flex gap-1 rounded-lg border p-1">
      {PERIODS.map((period) => (
        <Button
          key={period}
          size="sm"
          variant={period === days ? "secondary" : "ghost"}
          aria-current={period === days ? "true" : undefined}
          render={<Link href={`/metrics?days=${period}`} />}
          nativeButton={false}
        >
          {t("period.days", { count: period })}
        </Button>
      ))}
    </nav>
  )

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} actions={data ? switcher : null} />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        {!data ? (
          <EmptyState icon={<ChartColumnIcon />} title={t("forbidden")} />
        ) : (
          <>
            <Section
              title={t("captured.title")}
              description={t("captured.description", { count: data.captured.total })}
            >
              {data.captured.total ? (
                <CapturedChart points={data.captured.points} bySource={data.captured.bySource} />
              ) : (
                <EmptyState
                  icon={<UsersIcon />}
                  title={t("captured.emptyTitle")}
                  description={t("captured.emptyBody")}
                  action={
                    <Button render={<Link href="/qr-codes" />} nativeButton={false}>
                      {t("captured.emptyAction")}
                    </Button>
                  }
                />
              )}
            </Section>

            <Section title={t("outcomes.title")} description={t("outcomes.description")}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
                <StatCard
                  label={t("outcomes.consentWhatsapp")}
                  value={percent(data.consent.whatsapp, data.consent.guests)}
                  hint={t("outcomes.consentHint", { count: data.consent.whatsapp, total: data.consent.guests })}
                  icon={<ShieldCheckIcon />}
                />
                <StatCard
                  label={t("outcomes.consentEmail")}
                  value={percent(data.consent.email, data.consent.guests)}
                  hint={t("outcomes.consentHint", { count: data.consent.email, total: data.consent.guests })}
                  icon={<ShieldCheckIcon />}
                />
                <StatCard
                  label={t("outcomes.messages")}
                  value={data.messages.sent}
                  hint={t("outcomes.delivered", { rate: percent(data.messages.delivered, data.messages.sent) })}
                  icon={<SendIcon />}
                />
                <StatCard
                  label={t("outcomes.offers")}
                  value={data.offers.redeemed}
                  hint={t("outcomes.redemption", {
                    rate: percent(Math.min(data.offers.redeemed, data.offers.issued), data.offers.issued),
                    issued: data.offers.issued,
                  })}
                  icon={<GiftIcon />}
                />
                <StatCard
                  label={t("outcomes.reviews")}
                  value={data.reviewsRequested}
                  hint={t("outcomes.reviewsHint")}
                  icon={<StarIcon />}
                />
                <StatCard
                  label={t("outcomes.survey")}
                  value={data.survey.average ?? "–"}
                  hint={
                    data.survey ? t("outcomes.surveyHint", { count: data.survey.responses }) : t("outcomes.surveyEmpty")
                  }
                  icon={<StarIcon />}
                />
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  )
}
