import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { parseSpots } from "@ritorno/common/qr"
import { CAPTURE_SOURCES, type CaptureSource } from "@ritorno/common/schemas"
import { LOCALE_NAMES } from "@ritorno/i18n"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { cache } from "react"
import { Choices, PrintShell } from "@/components/print-shell"
import { KIT_PIECES, QrKitSheet } from "@/components/qr-kit-sheet"
import { logoSrc } from "@/lib/admin"
import { call } from "@/lib/api"

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// i18n-used: qrKit.pieceRoom
// i18n-used: qrKit.pieceTable
// i18n-used: qrKit.pieceDesk
const PIECE_LABELS = { room: "pieceRoom", table: "pieceTable", desk: "pieceDesk" } as const
const PIECES = Object.keys(CAPTURE_SOURCES) as CaptureSource[]

/** Once per request: the metadata and the page both need it. */
const getHotel = cache(() => call((api) => api.hotel.get()))

async function read(searchParams: Props["searchParams"]) {
  const query = await searchParams
  const hotel = await getHotel()
  return {
    hotel,
    piece: PIECES.find((piece) => piece === query.piece) ?? "desk",
    language: HOTEL_LANGUAGES.find((language) => language === query.lang) ?? hotel.defaultLanguage,
    spots: typeof query.spots === "string" ? query.spots : "",
  }
}

/** The document title is the file name the browser offers on "Save as PDF". */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { hotel, piece, language } = await read(searchParams)
  return { title: { absolute: `${hotel.slug}-${piece}-${language}` } }
}

const href = (piece: CaptureSource, language: string, spots: string) => {
  const query = new URLSearchParams({ piece, lang: language })
  if (spots) query.set("spots", spots)
  return `/print/qr-kit?${query}` as const
}

/** The printable QR kit: browser print makes the PDF, so Arabic is shaped by the browser and the QR stays vector. */
export default async function QrKitPage({ searchParams }: Props) {
  const { hotel, piece, language, spots } = await read(searchParams)
  const t = await getTranslations("qrKit")
  const [codes, perk] = await Promise.all([
    call((api) => api.hotel.qrCodes({ source: piece, spots: parseSpots(spots).spots })),
    // the public page hides a suspended hotel, which only the app admin can still open
    hotel.status === "suspended"
      ? null
      : call((api) => api.public.hotel({ slug: hotel.slug })).then((page) => page.welcomeOffer),
  ])
  const size = KIT_PIECES[piece]
  return (
    <PrintShell
      size={`${size.width}mm ${size.height}mm`}
      paper={size.paper}
      title={t("title")}
      note={[piece === "table" && t("foldHint"), piece !== "desk" && !parseSpots(spots).spots.length && t("noSpotNote")]
        .filter(Boolean)
        .join(" ")}
      pages={codes.length}
      controls={
        <div className="grid gap-3 md:grid-cols-2">
          <Choices
            label={t("pieceLabel")}
            items={PIECES.map((item) => ({
              key: item,
              label: t(PIECE_LABELS[item]),
              // spots belong to the piece they were generated for
              href: href(item, language, item === piece ? spots : ""),
              current: item === piece,
            }))}
          />
          <Choices
            label={t("languageLabel")}
            items={HOTEL_LANGUAGES.map((item) => ({
              key: item,
              label: LOCALE_NAMES[item],
              href: href(piece, item, spots),
              current: item === language,
              lang: item,
            }))}
          />
        </div>
      }
    >
      {codes.map((code) => (
        <QrKitSheet
          key={code.url}
          piece={piece}
          language={language}
          hotel={{
            displayName: hotel.displayName,
            logoSrc: logoSrc(hotel.logoKey),
            primaryColor: hotel.primaryColor,
            accentColor: hotel.accentColor,
          }}
          perk={perk}
          code={code}
        />
      ))}
    </PrintShell>
  )
}
