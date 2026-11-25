import { firstName } from "@le-hoetel/common/utils"
import { nextEnv } from "@le-hoetel/env/next"
import { isForbidden } from "@le-hoetel/orpc/errors"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Button } from "@le-hoetel/ui/components/button"
import { type DataColumn, DataTable } from "@le-hoetel/ui/components/data-table"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { Section } from "@le-hoetel/ui/components/section"
import { StatCard } from "@le-hoetel/ui/components/stat-card"
import { BuildingIcon, ExternalLinkIcon, UsersIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { CopyLink } from "@/components/copy-link"
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
  const { items, total } = await call((api) => api.guests.list({ limit: 5 }))
  const captureUrl = `${nextEnv().WEB_URL}/h/${hotel.slug}`
  const columns: DataColumn<(typeof items)[number]>[] = [
    { id: "name", header: t("name"), cell: (guest) => <span className="font-medium">{guest.name}</span> },
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
        <StatCard className="max-w-sm" label={t("guests")} value={total} hint={t("guestsHint")} icon={<UsersIcon />} />
        <Section title={t("latest")}>
          <DataTable
            caption={t("tableCaption")}
            columns={columns}
            rows={items}
            getRowKey={(guest) => guest.id}
            empty={<EmptyState decorated icon={<UsersIcon />} title={t("emptyTitle")} description={t("emptyBody")} />}
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
