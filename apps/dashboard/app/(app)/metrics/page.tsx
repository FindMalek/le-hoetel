import { isForbidden } from "@ritorno/orpc/errors"
import { Button } from "@ritorno/ui/components/button"
import { ChartCard } from "@ritorno/ui/components/chart-card"
import { PageState } from "@ritorno/ui/components/page-state"
import { Section } from "@ritorno/ui/components/section"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { formatNumber } from "@ritorno/ui/lib/number"
import { ChartColumnIcon, QrCodeIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { CapturedChart } from "@/components/captured-chart"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Metrics" }

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]

const isolated = (chunks: ReactNode) => <bdi dir="ltr">{chunks}</bdi>

export default async function MetricsPage({ searchParams }: PageProps<"/metrics">) {
  await connection()
  const raw = (await searchParams).days
  const asked = Number(Array.isArray(raw) ? raw[0] : raw)
  const days: Period = PERIODS.find((period) => period === asked) ?? 30
  const [t, locale] = await Promise.all([getTranslations("metrics"), getLocale()])
  const data = await call((api) => api.metrics.get({ days })).catch((error) => {
    if (isForbidden(error)) return null
    throw error
  })
  const num = (value: number) => formatNumber(value, locale)
  const rate = (part: number, whole: number) =>
    whole ? formatNumber(part / whole, locale, { style: "percent", maximumFractionDigits: 0 }) : "–"

  const switcher = (
    <SegmentedControl
      label={t("periodLabel")}
      value={String(days)}
      linkComponent={Link}
      options={PERIODS.map((period) => ({
        value: String(period),
        label: t("period.days", { count: period, shown: num(period) }),
        href: `/metrics?days=${period}`,
      }))}
    />
  )

  if (!data) {
    return (
      <>
        <PageHeader title={t("title")} description={t("description")} />
        <div className="p-4 md:p-6">
          <PageState kind="forbidden" icon={<ChartColumnIcon />} title={t("forbidden")} />
        </div>
      </>
    )
  }

  const { consent, messages, offers, survey } = data
  const redeemed = Math.min(offers.redeemed, offers.issued)

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} secondaryActions={switcher} />
      <div className="flex flex-col gap-8 p-4 md:gap-10 md:p-6">
        <ChartCard
          title={t("captured.title")}
          description={
            data.captured.total > 0 && (
              <>
                {t.rich("captured.description", {
                  count: data.captured.total,
                  shown: num(data.captured.total),
                  n: isolated,
                })}{" "}
                {data.bucket === "day" ? t("captured.byDay") : t("captured.byWeek")}
              </>
            )
          }
          isEmpty={data.captured.total === 0}
          empty={
            <PageState
              kind="empty"
              icon={<QrCodeIcon />}
              title={t("captured.emptyTitle")}
              description={t("captured.emptyBody")}
              action={
                <Button render={<Link href="/qr-codes" />} nativeButton={false}>
                  {t("captured.emptyAction")}
                </Button>
              }
            />
          }
        >
          <CapturedChart points={data.captured.points} bySource={data.captured.bySource} />
        </ChartCard>

        <Section title={t("reach.title")} description={t("reach.description")}>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatCard
              label={t("reach.whatsapp")}
              value={rate(consent.whatsapp, consent.guests)}
              hint={
                consent.guests
                  ? t.rich("reach.consentHint", {
                      count: num(consent.whatsapp),
                      total: num(consent.guests),
                      n: isolated,
                    })
                  : t("reach.consentEmpty")
              }
            />
            <StatCard
              label={t("reach.email")}
              value={rate(consent.email, consent.guests)}
              hint={
                consent.guests
                  ? t.rich("reach.consentHint", { count: num(consent.email), total: num(consent.guests), n: isolated })
                  : t("reach.consentEmpty")
              }
            />
            <StatCard
              label={t("reach.delivered")}
              value={num(messages.delivered)}
              hint={
                messages.sent ? (
                  <>
                    {t.rich("reach.deliveredHint", {
                      rate: rate(messages.delivered, messages.sent),
                      sent: num(messages.sent),
                      n: isolated,
                    })}
                    {messages.sent > messages.delivered && (
                      <span className="block">
                        {t.rich("reach.unconfirmedHint", {
                          count: num(messages.sent - messages.delivered),
                          n: isolated,
                        })}
                      </span>
                    )}
                  </>
                ) : (
                  t("reach.messagesEmpty")
                )
              }
            />
            <StatCard
              label={t("reach.failed")}
              value={num(messages.failed)}
              hint={messages.failed ? t("reach.failedHint") : t("reach.failedNone")}
            />
          </div>
        </Section>

        <Section title={t("results.title")} description={t("results.description")}>
          <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
            <StatCard
              label={t("results.redemption")}
              value={rate(redeemed, offers.issued)}
              hint={
                offers.issued
                  ? t.rich("results.redemptionHint", { count: num(redeemed), issued: num(offers.issued), n: isolated })
                  : t("results.redemptionEmpty")
              }
            />
            <StatCard
              label={t("results.survey")}
              value={survey.average === null ? "–" : num(survey.average)}
              hint={
                survey.responses
                  ? t.rich("results.surveyHint", {
                      count: survey.responses,
                      shown: num(survey.responses),
                      unhappy: num(survey.unhappy),
                      n: isolated,
                    })
                  : t("results.surveyEmpty")
              }
            />
            <StatCard
              label={t("results.reviews")}
              value={num(data.reviewsRequested)}
              hint={survey.responses ? t("results.reviewsHint") : t("results.reviewsEmpty")}
            />
          </div>
        </Section>
      </div>
    </>
  )
}
