import { GUEST_SOURCES } from "@le-hoetel/common/consent"
import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import { GUEST_CONSENT_FILTERS } from "@le-hoetel/common/schemas"
import { Button } from "@le-hoetel/ui/components/button"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { GuestFilters } from "@/components/guest-filters"
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
  const { activeId } = await call((api) => api.hotel.mine())
  const header = <PageHeader title={t("title")} description={t("description")} />
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
      <div className="grid gap-4 p-4 md:p-6">
        <GuestFilters values={{ q, ...filters }} />
        {items.length ? (
          <>
            <p className="text-muted-foreground text-sm">{t("total", { count: total })}</p>
            <GuestList guests={items} />
            {pages > 1 && (
              <nav className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={page <= 1}
                  render={<Link href={link(page - 1)} />}
                  nativeButton={false}
                >
                  <ChevronLeftIcon className="rtl:rotate-180" />
                  {t("previous")}
                </Button>
                <span className="text-muted-foreground text-sm">{t("page", { page, pages })}</span>
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={page >= pages}
                  render={<Link href={link(page + 1)} />}
                  nativeButton={false}
                >
                  {t("next")}
                  <ChevronRightIcon className="rtl:rotate-180" />
                </Button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            icon={<UsersIcon />}
            title={filtered ? t("noMatch.title") : t("empty.title")}
            description={filtered ? t("noMatch.description") : t("empty.description")}
          />
        )}
      </div>
    </>
  )
}
