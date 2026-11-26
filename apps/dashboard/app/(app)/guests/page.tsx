import { hotelRoles } from "@ritorno/auth/access"
import { GUEST_SOURCES } from "@ritorno/common/consent"
import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { GUEST_CONSENT_FILTERS } from "@ritorno/common/schemas"
import { Button } from "@ritorno/ui/components/button"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, UploadIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { GuestFilters } from "@/components/guest-filters"
import { GuestFinder } from "@/components/guest-finder"
import { GuestList } from "@/components/guest-list"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

const PAGE_SIZE = 25

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const oneOf = <T extends string>(options: readonly T[], value: string | undefined) =>
  options.find((option) => option === value)

function parseSearch(raw: Record<string, string | string[] | undefined>) {
  const page = Number(first(raw.page))
  return {
    q: (first(raw.q) ?? "").trim().slice(0, 80),
    consent: oneOf(GUEST_CONSENT_FILTERS, first(raw.consent)),
    source: oneOf(GUEST_SOURCES, first(raw.source)),
    language: oneOf(HOTEL_LANGUAGES, first(raw.language)),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export default async function GuestsPage({ searchParams }: PageProps<"/guests">) {
  const raw = await searchParams
  const { page, q, ...filters } = parseSearch(raw)
  const t = await getTranslations("guests")
  const { activeId, role } = await call((api) => api.hotel.mine())
  const canImport = role ? hotelRoles[role].authorize({ guest: ["import"] }).success : false
  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      action={
        activeId ? (
          <Button render={<Link href="/guests/new" />} nativeButton={false}>
            <PlusIcon data-icon="inline-start" />
            {t("addButton")}
          </Button>
        ) : null
      }
      secondaryActions={
        activeId &&
        canImport && (
          <Button variant="outline" render={<Link href="/guests/import" />} nativeButton={false}>
            <UploadIcon data-icon="inline-start" />
            {t("importButton")}
          </Button>
        )
      }
    />
  )
  if (!activeId) {
    return (
      <>
        {header}
        <div className="p-4 md:p-6">
          <EmptyState icon={<UsersIcon />} title={t("noHotel.title")} description={t("noHotel.description")} />
        </div>
      </>
    )
  }

  const { items, total } = await call((api) =>
    api.guests.list({ ...filters, q: q || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
  )
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = Boolean(q || filters.consent || filters.source || filters.language)
  const link = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...filters, q })) if (value) params.set(key, value)
    params.set("page", String(target))
    return `/guests?${params}` as const
  }

  return (
    <>
      {header}
      <div className="flex flex-col gap-4 p-4 md:p-6">
        {total > 0 || filtered ? <GuestFinder /> : null}
        <GuestFilters values={{ q, ...filters }} />
        {items.length ? (
          <>
            <GuestList guests={items} total={total} />
            {pages > 1 && (
              <nav className="flex items-center justify-between gap-3" aria-label={t("pagination")}>
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  render={<Link href={link(page - 1)} />}
                  nativeButton={false}
                >
                  <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
                  {t("previous")}
                </Button>
                <span className="text-muted-foreground text-sm tabular-nums">{t("page", { page, pages })}</span>
                <Button
                  variant="outline"
                  disabled={page >= pages}
                  render={<Link href={link(page + 1)} />}
                  nativeButton={false}
                >
                  {t("next")}
                  <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
                </Button>
              </nav>
            )}
          </>
        ) : filtered ? (
          <EmptyState
            icon={<UsersIcon />}
            title={t("noMatch.title")}
            description={t("noMatch.description")}
            action={
              <Button variant="outline" render={<Link href="/guests" />} nativeButton={false}>
                {t("reset")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            decorated
            icon={<UsersIcon />}
            title={t("empty.title")}
            description={t("empty.description")}
            action={
              <Button render={<Link href="/guests/new" />} nativeButton={false}>
                <PlusIcon data-icon="inline-start" />
                {t("addButton")}
              </Button>
            }
          />
        )}
      </div>
    </>
  )
}
