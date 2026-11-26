import { brandStyle } from "@ritorno/common/color"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { printedUrl, staffLabel } from "@ritorno/common/qr"
import type { SpotSource } from "@ritorno/common/schemas"
import { getDirection } from "@ritorno/i18n"
import { cn } from "@ritorno/ui/lib/utils"
import { getTranslations } from "next-intl/server"
import type { KitHotel } from "@/components/qr-kit-sheet"
import { QrMark } from "@/components/qr-mark"

/** All in mm. A 39 mm code scans from arm's length; the margins hold the crop marks inside any printer's reach. */
const PAGE = { width: 210, height: 297 }
const CELL = { width: 45, height: 52 }
const COLUMNS = 4
const ROWS = 5
const CODE = 39
const LEFT = (PAGE.width - COLUMNS * CELL.width) / 2
const TOP = (PAGE.height - ROWS * CELL.height) / 2
const MARK = { length: 8, gap: 2 }

export const CODES_PER_PAGE = COLUMNS * ROWS

export type CutCode = { source: SpotSource; location: string | null; url: string; svg: string }

const lines = (count: number, start: number, step: number) =>
  Array.from({ length: count + 1 }, (_, i) => start + i * step)

/** Short ticks in the margin at every cut line, so no line is ever printed on a sticker. */
function CropMarks() {
  const right = LEFT + COLUMNS * CELL.width
  const bottom = TOP + ROWS * CELL.height
  const near = MARK.gap
  const far = MARK.gap + MARK.length
  return (
    <path
      className="fill-none stroke-foreground"
      strokeWidth="0.2"
      d={[
        ...lines(COLUMNS, LEFT, CELL.width).map(
          (x) => `M${x} ${TOP - far}V${TOP - near}M${x} ${bottom + near}V${bottom + far}`,
        ),
        ...lines(ROWS, TOP, CELL.height).map(
          (y) => `M${LEFT - far} ${y}H${LEFT - near}M${right + near} ${y}H${right + far}`,
        ),
      ].join("")}
    />
  )
}

/**
 * One A4 page of stickers: the hotel's mark inside each code, a line telling the guest to scan it in `language`, and the
 * tiny staff label saying where it goes.
 */
export async function QrCutSheet({
  language,
  hotel,
  codes,
  alt,
}: {
  language: HotelLanguage
  hotel: KitHotel
  codes: CutCode[]
  alt: string
}) {
  const t = await getTranslations({ locale: language, namespace: "qrKit" })
  const scan = t("sheetScan")
  return (
    <svg
      viewBox={`0 0 ${PAGE.width} ${PAGE.height}`}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={brandStyle(hotel)}
      className="aspect-[210/297] w-[210mm] max-w-full shrink-0 break-inside-avoid bg-white text-foreground shadow-md [print-color-adjust:exact] print:h-[297mm] print:max-w-none print:shadow-none print:[&:not(:last-child)]:break-after-page"
    >
      <title>{alt}</title>
      <CropMarks />
      {codes.map((code, index) => {
        const x = LEFT + (index % COLUMNS) * CELL.width
        const y = TOP + Math.floor(index / COLUMNS) * CELL.height
        const label = staffLabel(code.source, code.location) ?? ""
        const address = printedUrl(code.url)
        return (
          <g key={code.url}>
            <QrMark
              svg={code.svg}
              hotel={hotel}
              label={label}
              x={x + (CELL.width - CODE) / 2}
              y={y + 2}
              width={CODE}
              height={CODE}
            />
            <text
              x={x + CELL.width / 2}
              y={y + CODE + 4.5}
              textAnchor="middle"
              fontSize="3.2"
              lang={language}
              direction={getDirection(language)}
              className={cn("fill-foreground font-semibold", language === "ar" ? "font-arabic" : "font-sans")}
            >
              {scan}
            </text>
            <text
              x={x + CELL.width / 2}
              y={y + CODE + 8}
              textAnchor="middle"
              fontSize="2.4"
              direction="ltr"
              className="fill-foreground font-mono"
              // a monospace letter is 0.6 em: a long host is squeezed to the sticker
              {...(address.length * 1.44 > CELL.width - 4
                ? { textLength: CELL.width - 4, lengthAdjust: "spacingAndGlyphs" }
                : {})}
            >
              {address}
            </text>
            <text
              x={x + CELL.width / 2}
              y={y + CODE + 11}
              textAnchor="middle"
              fontSize="2.2"
              direction="ltr"
              className="fill-muted-foreground font-sans"
              // a long name is squeezed to the sticker instead of running into the next one
              {...(label.length > 24 ? { textLength: CELL.width - 6, lengthAdjust: "spacingAndGlyphs" } : {})}
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
