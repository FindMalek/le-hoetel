import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { SPOT_SOURCES, type Spot } from "@ritorno/common/schemas"
import { LOCALE_NAMES } from "@ritorno/i18n"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { cache } from "react"
import { Choices, PrintShell } from "@/components/print-shell"
import { CODES_PER_PAGE, type CutCode, QrCutSheet } from "@/components/qr-cut-sheet"
import { logoSrc } from "@/lib/admin"
import { call } from "@/lib/api"

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** The most names `hotel.qrCodes` takes in one call. */
const BATCH = 100

const getHotel = cache(() => call((api) => api.hotel.get()))

/** The language of the words on the stickers, not of the dashboard. */
async function read(searchParams: Props["searchParams"]) {
  const [query, hotel] = await Promise.all([searchParams, getHotel()])
  const language = HOTEL_LANGUAGES.find((item) => item === query.lang) ?? hotel.defaultLanguage
  return { query, hotel, language }
}

/** The document title is the file name the browser offers on "Save as PDF". */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { hotel, language } = await read(searchParams)
  return { title: { absolute: `${hotel.slug}-cut-sheet-${language}` } }
}

/** The same selection in another language. */
function href(query: Awaited<Props["searchParams"]>, language: HotelLanguage) {
  const next = new URLSearchParams({ lang: language })
  for (const source of SPOT_SOURCES) {
    if (query[source]) next.set(source, String(query[source]))
  }
  return `/print/qr-sheet?${next}` as const
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
  const [{ query, hotel, language }, saved, t] = await Promise.all([
    read(searchParams),
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
      controls={
        <Choices
          label={t("languageLabel")}
          items={HOTEL_LANGUAGES.map((item) => ({
            key: item,
            label: LOCALE_NAMES[item],
            href: href(query, item),
            current: item === language,
            lang: item,
          }))}
        />
      }
    >
      {pages.map((codes) => (
        <QrCutSheet key={codes[0]?.url} language={language} hotel={brand} codes={codes} alt={t("sheetTitle")} />
      ))}
    </PrintShell>
  )
}
