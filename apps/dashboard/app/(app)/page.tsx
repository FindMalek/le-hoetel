import { hotelRoles } from "@le-hoetel/auth/access"
import { firstName } from "@le-hoetel/common/utils"
import { nextEnv } from "@le-hoetel/env/next"
import { isForbidden } from "@le-hoetel/orpc/errors"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Button } from "@le-hoetel/ui/components/button"
import { type DataColumn, DataTable } from "@le-hoetel/ui/components/data-table"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { Section } from "@le-hoetel/ui/components/section"
import { StatCard } from "@le-hoetel/ui/components/stat-card"
import {
  BuildingIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  GiftIcon,
  QrCodeIcon,
  SendIcon,
  ShieldCheckIcon,
  SmileIcon,
  UploadIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { CopyLink } from "@/components/copy-link"
import { FirstRunChecklist } from "@/components/first-run-checklist"
import { GuestFinder } from "@/components/guest-finder"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
import { TopBarAction } from "@/components/top-bar"
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
async function HotelHome({ name, hotel }: { name: string; hotel: { displayName: string; slug: string } }) {
  const t = await getTranslations("home")
  const tLang = await getTranslations("home.languages")
  const tFinder = await getTranslations("guests.finder")
  const [{ role }, overview, { items }] = await Promise.all([
    call((api) => api.hotel.mine()),
    call((api) => api.overview.get()),
    call((api) => api.guests.list({ limit: 5 })),
  ])
  const manager = role === "owner" || role === "manager"
  const canImport = role ? hotelRoles[role].authorize({ guest: ["import"] }).success : false
  const captureUrl = `${nextEnv().WEB_URL}/h/${hotel.slug}`
  const { guests, messagesSent, offersRedeemed } = overview
  const rate = guests.total ? Math.round((guests.consented / guests.total) * 100) : null

  const actions = [
    { href: "/guests/new", label: t("actions.add"), body: t("actions.addBody"), icon: <UserPlusIcon /> },
    { href: "/qr-codes", label: t("actions.qr"), body: t("actions.qrBody"), icon: <QrCodeIcon /> },
    ...(canImport
      ? [{ href: "/guests/import", label: t("actions.import"), body: t("actions.importBody"), icon: <UploadIcon /> }]
      : []),
  ] as const

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
      cell: (guest) => (
        <bdi dir="ltr" className="tabular-nums">
          {guest.phoneE164}
        </bdi>
      ),
      showFrom: "md",
    },
    {
      id: "language",
      header: t("language"),
      cell: (guest) => <Badge variant="secondary">{tLang(guest.language)}</Badge>,
    },
    { id: "added", header: t("added"), cell: (guest) => <LocalDate value={guest.createdAt} />, align: "end" },
  ]
  return (
    <>
      <PageHeader title={t("greeting", { name })} description={t("hotelDescription", { hotel: hotel.displayName })} />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        {manager && <FirstRunChecklist state={overview.checklist} />}

        <Section title={tFinder("label")}>
          <GuestFinder />
        </Section>

        <Section title={t("pulse.title")} description={t("pulse.description")}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
            <StatCard
              label={t("pulse.newGuests")}
              value={guests.week}
              hint={t("pulse.today", { count: guests.today })}
              icon={<UsersIcon />}
            />
            <StatCard
              label={t("pulse.consent")}
              value={rate === null ? "–" : `${rate}%`}
              hint={t("pulse.consentHint", { consented: guests.consented, total: guests.total })}
              icon={<ShieldCheckIcon />}
            />
            <StatCard
              label={t("pulse.messages")}
              value={messagesSent.week}
              hint={t("pulse.today", { count: messagesSent.today })}
              icon={<SendIcon />}
            />
            <StatCard
              label={t("pulse.offers")}
              value={offersRedeemed.week}
              hint={t("pulse.today", { count: offersRedeemed.today })}
              icon={<GiftIcon />}
            />
          </div>
        </Section>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
          <Section title={t("unhappy.title")} description={t("unhappy.description")}>
            <EmptyState icon={<SmileIcon />} title={t("unhappy.emptyTitle")} description={t("unhappy.emptyBody")} />
          </Section>
          <Section title={t("actions.title")}>
            <ul className="flex flex-col divide-y rounded-lg border bg-card">
              {actions.map((action) => (
                <li key={action.href}>
                  <Link
                    href={action.href as Route}
                    className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-5">
                      {action.icon}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium text-sm">{action.label}</span>
                      <span className="text-muted-foreground text-xs">{action.body}</span>
                    </span>
                    <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>

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
          <DataTable
            caption={t("tableCaption")}
            columns={columns}
            rows={items}
            getRowKey={(guest) => guest.id}
            empty={
              <EmptyState
                decorated
                icon={<UsersIcon />}
                title={t("emptyTitle")}
                description={t("emptyBody")}
                action={
                  <Button render={<Link href="/guests/new" />} nativeButton={false}>
                    {t("actions.add")}
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
  const t = await getTranslations("home")
  const tHealth = await getTranslations("adminHotels.health")
  const hotels = await call((api) => api.admin.hotels.list()).catch((error) => {
    if (isForbidden(error)) return []
    throw error
  })
  const attention = hotels.filter((hotel) => hotel.health !== "healthy")
  const columns: DataColumn<(typeof hotels)[number]>[] = [
    {
      id: "hotel",
      header: t("hotelColumn"),
      cell: (hotel) => <span className="font-medium">{hotel.displayName}</span>,
    },
    { id: "guests", header: t("guests"), cell: (hotel) => hotel.guestCount, align: "end" },
    {
      id: "health",
      header: t("healthColumn"),
      cell: (hotel) => (
        <Badge variant={hotel.health === "healthy" ? "secondary" : "outline"}>{tHealth(hotel.health)}</Badge>
      ),
    },
  ]
  return (
    <>
      <PageHeader title={t("greeting", { name })} description={t("adminDescription")} />
      <TopBarAction href="/admin/hotels" label={t("hotelsAction")} icon={<BuildingIcon />} />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
          <StatCard label={t("hotels")} value={hotels.length} icon={<BuildingIcon />} />
          <StatCard
            label={t("guests")}
            value={hotels.reduce((sum, hotel) => sum + hotel.guestCount, 0)}
            icon={<UsersIcon />}
          />
          <StatCard label={t("needAttention")} value={attention.length} hint={t("attentionHint")} />
        </div>
        <Section title={t("hotels")}>
          <DataTable
            caption={t("hotelsCaption")}
            columns={columns}
            rows={hotels}
            getRowKey={(hotel) => hotel.id}
            empty={
              <EmptyState
                decorated
                icon={<BuildingIcon />}
                title={t("noHotelsTitle")}
                description={t("noHotelsBody")}
              />
            }
          />
        </Section>
      </div>
    </>
  )
}
