import { SPOT_SOURCES, type Spot } from "@ritorno/common/schemas"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { cache } from "react"
import { PrintShell } from "@/components/print-shell"
import { CODES_PER_PAGE, type CutCode, QrCutSheet } from "@/components/qr-cut-sheet"
import { logoSrc } from "@/lib/admin"
import { call } from "@/lib/api"

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** The most names `hotel.qrCodes` takes in one call. */
const BATCH = 100

const getHotel = cache(() => call((api) => api.hotel.get()))

/** The document title is the file name the browser offers on "Save as PDF". */
export async function generateMetadata(): Promise<Metadata> {
  const { slug } = await getHotel()
  return { title: { absolute: `${slug}-cut-sheet` } }
}

const chunks = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

/** `?room=101,102&table=4` prints that selection; no parameter prints every saved spot. */
function selected(spots: Spot[], query: Awaited<Props["searchParams"]>): Spot[] {
  if (!SPOT_SOURCES.some((source) => query[source])) return spots
  const wanted = new Set(
    SPOT_SOURCES.flatMap((source) =>
      String(query[source] ?? "")
        .split(",")
        .map((name) => `${source}:${name}`),
    ),
  )
  return spots.filter((spot) => wanted.has(`${spot.source}:${spot.name}`))
}

export default async function QrSheetPage({ searchParams }: Props) {
  const [query, hotel, saved, t] = await Promise.all([
    searchParams,
    getHotel(),
    call((api) => api.hotel.spots.list()),
    getTranslations("qrKit"),
  ])
  const spots = selected(saved, query)
  const batches = await Promise.all(
    SPOT_SOURCES.flatMap((source) => {
      const names = spots.filter((spot) => spot.source === source).map((spot) => spot.name)
      return chunks(names, BATCH).map(async (part): Promise<CutCode[]> => {
        const codes = await call((api) => api.hotel.qrCodes({ source, spots: part }))
        return codes.map((code) => ({ ...code, source }))
      })
    }),
  )
  const pages = chunks(batches.flat(), CODES_PER_PAGE)
  const brand = {
    displayName: hotel.displayName,
    logoSrc: logoSrc(hotel.logoKey),
    primaryColor: hotel.primaryColor,
    accentColor: hotel.accentColor,
  }
  return (
    <PrintShell
      size="A4"
      paper="A4"
      title={t("sheetTitle")}
      note={pages.length ? t("sheetNote", { count: spots.length }) : t("sheetEmpty")}
      pages={pages.length}
    >
      {pages.map((codes) => (
        <QrCutSheet key={codes[0]?.url} hotel={brand} codes={codes} alt={t("sheetTitle")} />
      ))}
    </PrintShell>
  )
}
