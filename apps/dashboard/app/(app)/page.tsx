import { firstName } from "@ritorno/common/utils"
import { nextEnv } from "@ritorno/env/next"
import { isForbidden } from "@ritorno/orpc/errors"
import { Button } from "@ritorno/ui/components/button"
import { ChartCard } from "@ritorno/ui/components/chart-card"
import { DataList } from "@ritorno/ui/components/data-list"
import type { DataColumn } from "@ritorno/ui/components/data-table"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { Num } from "@ritorno/ui/components/num"
import { PageState } from "@ritorno/ui/components/page-state"
import { Section } from "@ritorno/ui/components/section"
import { StatCard, type StatDelta } from "@ritorno/ui/components/stat-card"
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { formatDelta, formatNumber } from "@ritorno/ui/lib/number"
import {
  BuildingIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  PlusIcon,
  QrCodeIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { AdminAttention } from "@/components/admin-attention"
import { CapturedChart } from "@/components/captured-chart"
import { CopyLink } from "@/components/copy-link"
import { FirstRunChecklist } from "@/components/first-run-checklist"
import { HomeAttention } from "@/components/home-attention"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export default async function HomePage() {
  const [me, hotel] = await Promise.all([
    call((api) => api.me.get()),
    call((api) => api.hotel.get()).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
  ])
  if (hotel) return <HotelHome name={firstName(me.name)} hotel={hotel} />
  return me.role === "admin" ? <PlatformHome name={firstName(me.name)} /> : <NoHotelHome name={firstName(me.name)} />
}

async function NoHotelHome({ name }: { name: string }) {
  const t = await getTranslations("home")
  return (
    <>
      <PageHeader title={t("greeting", { name })} />
      <div className="p-4 md:p-6">
        <EmptyState decorated icon={<BuildingIcon />} title={t("noAccessTitle")} description={t("noAccessBody")} />
      </div>
    </>
  )
}

// i18n-used: home.languages
async function HotelHome({
  name,
  hotel,
}: {
  name: string
  hotel: { displayName: string; slug: string; timezone: string }
}) {
  const t = await getTranslations("home")
  const tLang = await getTranslations("home.languages")
  const locale = await getLocale()
  const [{ role }, overview, trend, inbox, { items }] = await Promise.all([
    call((api) => api.hotel.mine()),
    call((api) => api.overview.get()),
    call((api) => api.metrics.get({ days: 7 })),
    call((api) => api.inbox.list()),
    call((api) => api.guests.list({ limit: 5 })),
  ])
  const manager = role === "owner" || role === "manager"
  const captureUrl = `${nextEnv().WEB_URL}/h/${hotel.slug}`
  const { lastWeek } = overview
  const count = (value: number) => formatNumber(value, locale)
  const change = (current: number, previous: number): StatDelta | undefined => {
    if (!current && !previous) return undefined
    const diff = Math.round((current - previous) * 10) / 10
    return {
      direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
      value: formatDelta(diff, locale, { maximumFractionDigits: 1 }),
    }
  }
  const score = lastWeek.survey

  const columns: DataColumn<(typeof items)[number]>[] = [
    {
      id: "name",
      header: t("name"),
      cell: (guest) => (
        <Link href={`/guests/${guest.id}`} className="font-medium underline-offset-4 hover:underline">
          {guest.name}
        </Link>
      ),
    },
    {
      id: "phone",
      header: t("phone"),
      cell: (guest) => <Num value={guest.phoneE164} className="tabular-nums" />,
      showFrom: "md",
    },
    {
      id: "language",
      header: t("language"),
      cell: (guest) => <StatusBadge icon={null}>{tLang(guest.language)}</StatusBadge>,
    },
    {
      id: "added",
      header: t("added"),
      cell: (guest) => formatDate(guest.createdAt, locale, hotel.timezone),
      align: "end",
    },
  ]
  return (
    <>
      <PageHeader
        title={t("greeting", { name })}
        description={t("hotelDescription", { hotel: hotel.displayName })}
        action={
          <Button render={<Link href="/guests/new" />} nativeButton={false}>
            <UserPlusIcon data-icon="inline-start" />
            {t("addGuest")}
          </Button>
        }
      />
      <div className="flex flex-col gap-8 p-4 md:gap-10 md:p-6">
        <Section title={t("attention.title")}>
          <HomeAttention alerts={overview.alerts} unread={inbox.unread} timeZone={hotel.timezone} />
        </Section>

        {manager && <FirstRunChecklist state={overview.checklist} />}

        <Section
          title={t("week.title")}
          description={t("week.description")}
          actions={
            <Button variant="ghost" size="sm" render={<Link href="/metrics" />} nativeButton={false}>
              {t("week.more")}
              <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
            </Button>
          }
        >
          <div className="grid gap-3 md:gap-4 lg:grid-cols-5">
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-3">
              <StatCard
                label={t("week.guests")}
                value={count(lastWeek.guests.current)}
                delta={change(lastWeek.guests.current, lastWeek.guests.previous)}
              />
              <StatCard
                label={t("week.returning")}
                value={count(lastWeek.returning.current)}
                delta={change(lastWeek.returning.current, lastWeek.returning.previous)}
              />
              <StatCard
                label={t("week.score")}
                value={score.current === null ? "–" : formatNumber(score.current, locale)}
                delta={
                  score.current !== null && score.previous !== null ? change(score.current, score.previous) : undefined
                }
                hint={
                  score.responses
                    ? t("week.scoreHint", { count: score.responses, shown: count(score.responses) })
                    : t("week.scoreEmpty")
                }
              />
              <StatCard
                label={t("week.offers")}
                value={count(lastWeek.offersRedeemed.current)}
                delta={change(lastWeek.offersRedeemed.current, lastWeek.offersRedeemed.previous)}
              />
            </div>
            <ChartCard
              className="lg:col-span-2"
              title={t("week.trend")}
              description={t("week.trendBody")}
              isEmpty={trend.captured.total === 0}
              empty={<p className="py-6 text-center text-muted-foreground text-small">{t("week.trendEmpty")}</p>}
            >
              <CapturedChart compact points={trend.captured.points} bySource={trend.captured.bySource} />
            </ChartCard>
          </div>
        </Section>

        <Section
          title={t("latest")}
          actions={
            items.length ? (
              <Button variant="ghost" size="sm" render={<Link href="/guests" />} nativeButton={false}>
                {t("seeAll")}
                <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
              </Button>
            ) : null
          }
        >
          <DataList
            caption={t("tableCaption")}
            columns={columns}
            rows={items}
            getRowKey={(guest) => guest.id}
            card={(guest) => (
              <Link href={`/guests/${guest.id}`} className="-m-4 flex items-center justify-between gap-3 p-4">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{guest.name}</span>
                  <Num value={guest.phoneE164} className="text-muted-foreground text-small tabular-nums" />
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 text-caption text-muted-foreground">
                  <StatusBadge icon={null}>{tLang(guest.language)}</StatusBadge>
                  {formatDate(guest.createdAt, locale, hotel.timezone)}
                </span>
              </Link>
            )}
            linkComponent={Link}
            empty={
              <PageState
                kind="empty"
                firstRun
                icon={<UsersIcon />}
                title={t("emptyTitle")}
                description={t("emptyBody")}
                action={
                  <Button render={<Link href="/qr-codes" />} nativeButton={false}>
                    <QrCodeIcon data-icon="inline-start" />
                    {t("emptyAction")}
                  </Button>
                }
              />
            }
          />
        </Section>

        <Section title={t("captureTitle")} description={t("captureBody")}>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLink url={captureUrl} label={t("copy")} done={t("copied")} />
            <Button
              variant="ghost"
              render={<a href={captureUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              {t("open")}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </div>
        </Section>
      </div>
    </>
  )
}

async function PlatformHome({ name }: { name: string }) {
  const [t, locale] = await Promise.all([getTranslations("home"), getLocale()])
  const [hotels, overview] = await Promise.all([
    call((api) => api.admin.hotels.list()),
    call((api) => api.admin.hotels.overview()),
  ]).catch((error) => {
    if (isForbidden(error)) return [[], null] as const
    throw error
  })
  const count = (value: number) => formatNumber(value, locale)
  return (
    <>
      <PageHeader
        title={t("greeting", { name })}
        description={t("adminDescription")}
        action={
          <Button render={<Link href="/admin/hotels" />} nativeButton={false}>
            <BuildingIcon data-icon="inline-start" />
            {t("hotelsAction")}
          </Button>
        }
      />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        {hotels.length === 0 || !overview ? (
          <PageState
            kind="empty"
            firstRun
            icon={<BuildingIcon />}
            title={t("noHotelsTitle")}
            description={t("noHotelsBody")}
            action={
              <Button render={<Link href="/admin/hotels/new" />} nativeButton={false}>
                <PlusIcon data-icon="inline-start" />
                {t("newHotel")}
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
              <StatCard
                label={t("hotels")}
                value={count(hotels.length)}
                icon={<BuildingIcon />}
                link={
                  <Link href="/admin/overview" className="text-primary underline underline-offset-4">
                    {t("overviewLink")}
                  </Link>
                }
              />
              <StatCard label={t("guests")} value={count(overview.guests.total)} icon={<UsersIcon />} />
              <StatCard
                label={t("lowBalance")}
                value={count(overview.lowBalance.length)}
                icon={<WalletIcon />}
                hint={t("lowBalanceHint")}
              />
            </div>
            <Section title={t("needAttention")} description={t("attentionHint")}>
              <AdminAttention hotels={hotels} lowBalance={overview.lowBalance} now={new Date()} />
            </Section>
          </>
        )}
      </div>
    </>
  )
}
