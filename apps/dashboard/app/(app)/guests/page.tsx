import { hotelRoles } from "@ritorno/auth/access"
import { GUEST_SOURCES } from "@ritorno/common/consent"
import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { GUEST_CONSENT_FILTERS } from "@ritorno/common/schemas"
import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { pageWindow } from "@ritorno/ui/lib/pagination"
import { PlusIcon, SearchXIcon, UploadIcon, UsersIcon } from "lucide-react"
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
  return {
    q: (first(raw.q) ?? "").trim().slice(0, 80),
    consent: oneOf(GUEST_CONSENT_FILTERS, first(raw.consent)),
    source: oneOf(GUEST_SOURCES, first(raw.source)),
    language: oneOf(HOTEL_LANGUAGES, first(raw.language)),
    returning: first(raw.returning) === "1" ? "1" : undefined,
    page: Number(first(raw.page)) || 1,
  }
}

export default async function GuestsPage({ searchParams }: PageProps<"/guests">) {
  const { page, ...values } = parseSearch(await searchParams)
  const { q, returning, ...filters } = values
  const t = await getTranslations("guests")
  const { activeId, role } = await call((api) => api.hotel.mine())
  const canImport = role ? hotelRoles[role].authorize({ guest: ["import"] }).success : false
  const addButton = (
    <Button render={<Link href="/guests/new" />} nativeButton={false}>
      <PlusIcon data-icon="inline-start" />
      {t("addButton")}
    </Button>
  )
  const header = (
    <PageHeader
      title={t("title")}
      description={t("description")}
      action={activeId ? addButton : null}
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
          <PageState
            kind="empty"
            icon={<UsersIcon />}
            title={t("noHotel.title")}
            description={t("noHotel.description")}
          />
        </div>
      </>
    )
  }

  const current = Math.max(1, Math.trunc(page))
  const { items, total } = await call((api) =>
    api.guests.list({
      ...filters,
      q: q || undefined,
      returning: returning ? true : undefined,
      limit: PAGE_SIZE,
      offset: (current - 1) * PAGE_SIZE,
    }),
  )
  const pages = pageWindow({ page: current, pageSize: PAGE_SIZE, total })
  const filtered = Object.values(values).some(Boolean)
  const link = (target: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
    if (target > 1) params.set("page", String(target))
    const query = params.toString()
    return query ? `/guests?${query}` : "/guests"
  }

  const empty = filtered ? (
    <PageState
      kind="empty"
      icon={<SearchXIcon />}
      title={t("noMatch.title")}
      description={t("noMatch.description")}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" render={<Link href="/guests" />} nativeButton={false}>
            {t("reset")}
          </Button>
          {addButton}
        </div>
      }
    />
  ) : (
    <PageState
      kind="empty"
      firstRun
      icon={<UsersIcon />}
      title={t("empty.title")}
      description={t("empty.description")}
      action={addButton}
    />
  )

  return (
    <>
      {header}
      <div className="p-4 md:p-6">
        <GuestList
          guests={items}
          total={total}
          page={pages.page}
          pageSize={PAGE_SIZE}
          previousHref={pages.hasPrevious ? link(pages.page - 1) : undefined}
          nextHref={pages.hasNext ? link(pages.page + 1) : undefined}
          filters={total > 0 || filtered ? <GuestFilters values={values} /> : null}
          empty={empty}
        />
      </div>
    </>
  )
}
