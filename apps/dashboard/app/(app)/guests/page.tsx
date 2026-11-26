import { hotelRoles } from "@ritorno/auth/access"
import { GUEST_SOURCES } from "@ritorno/common/consent"
import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { GUEST_CONSENT_FILTERS } from "@ritorno/common/schemas"
import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { PlusIcon, SearchXIcon, UploadIcon, UsersIcon } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { GuestFilters } from "@/components/guest-filters"
import { GuestList } from "@/components/guest-list"
import { PageHeader } from "@/components/page-header"
import { call, currentHotel, getQueryClient, serverOrpc } from "@/lib/api"
import { guestsList } from "@/lib/lists"

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
  }
}

export default async function GuestsPage({ searchParams }: PageProps<"/guests">) {
  const values = parseSearch(await searchParams)
  const { q, returning, ...filters } = values
  const t = await getTranslations("guests")
  const [{ activeId, role }, hotel] = await Promise.all([call((api) => api.hotel.mine()), currentHotel()])
  const hotelId = hotel?.id ?? activeId
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
      action={hotelId ? addButton : null}
      secondaryActions={
        hotelId &&
        canImport && (
          <Button variant="outline" render={<Link href="/guests/import" />} nativeButton={false}>
            <UploadIcon data-icon="inline-start" />
            {t("importButton")}
          </Button>
        )
      }
    />
  )
  if (!hotelId) {
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

  const query = { ...filters, q: q || undefined, returning: returning ? true : undefined }
  const queryClient = getQueryClient()
  await call(() => queryClient.fetchInfiniteQuery(guestsList(serverOrpc, hotelId, query)))
  const filtered = Object.values(values).some(Boolean)

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
        <HydrationBoundary state={dehydrate(queryClient)}>
          <GuestList
            hotelId={hotelId}
            query={query}
            filtered={filtered}
            filters={<GuestFilters values={values} />}
            empty={empty}
          />
        </HydrationBoundary>
      </div>
    </>
  )
}
