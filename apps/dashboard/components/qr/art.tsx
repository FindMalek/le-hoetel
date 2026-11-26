import { brandStyle } from "@ritorno/common/color"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { printedUrl, staffLabel } from "@ritorno/common/qr"
import type { CaptureSource } from "@ritorno/common/schemas"
import { getDirection } from "@ritorno/i18n"
import { cn } from "@ritorno/ui/lib/utils"
import { QrMark } from "@/components/qr-mark"

/** What is printed, and drawn in the preview: one component, so the two never differ. */
export type Piece = CaptureSource | "sticker"

export type KitHotel = {
  displayName: string
  logoSrc: string | null
  primaryColor: string | null
  accentColor: string | null
}

export type KitCode = { source: CaptureSource; location: string | null; url: string; svg: string }

/** The words on the paper, in the language of the paper, not of the dashboard. */
export type KitWords = {
  headlines: Record<CaptureSource, string>
  scan: string
  noApp: string
  perkTitle: string
  perkBody: string
  alt: string
  sheetScan: string
}

export type CardText = {
  language: HotelLanguage
  words: KitWords
  headline: string
  /** `null` leaves the perk off. */
  perk: { title: string; text: string } | null
}

/** The paper each card prints on, in mm. The table tent is one A5 sheet folded in half into two faces. */
export const CARD_SIZES = {
  room: { width: 105, height: 148, sheet: "aspect-[105/148] print:h-[148mm] print:w-[105mm]" },
  table: { width: 148, height: 210, sheet: "aspect-[148/210] print:h-[210mm] print:w-[148mm]" },
  desk: { width: 148, height: 210, sheet: "aspect-[148/210] print:h-[210mm] print:w-[148mm]" },
} as const satisfies Record<CaptureSource, object>

/** Past this length the perk text drops a size, so the longest offer (400 characters) still fits. */
const LONG_PERK = 160

type Face = CardText & { hotel: KitHotel; code: KitCode }

function Brand({ hotel, className }: { hotel: KitHotel; className?: string }) {
  return (
    <header
      className={cn(
        "flex w-full items-center gap-[2.5cqw] rounded-[3.5cqw] bg-primary p-[2.5cqw] text-start text-primary-foreground",
        className,
      )}
    >
      {hotel.logoSrc ? (
        // biome-ignore lint/performance/noImgElement: a hotel upload, printed as is
        <img src={hotel.logoSrc} alt="" className="size-[13cqw] rounded-[2cqw] bg-white object-contain p-[1cqw]" />
      ) : null}
      <p className="min-w-0 flex-1 break-words font-semibold text-[1em] leading-tight">
        <bdi>{hotel.displayName}</bdi>
      </p>
    </header>
  )
}

/** Black on white whatever the brand, with a quiet zone inside the colored frame, so every camera reads it. */
function Code({ face, className }: { face: Face; className: string }) {
  return (
    <QrMark
      svg={face.code.svg}
      hotel={face.hotel}
      label={face.words.alt}
      className={cn(
        "aspect-square shrink-0 rounded-[3cqw] border-[0.8cqw] border-brand-accent bg-white p-[3cqw]",
        className,
      )}
    />
  )
}

function StaffLabel({ code, className }: { code: KitCode; className: string }) {
  const spot = staffLabel(code.source, code.location)
  return spot ? (
    <p dir="ltr" className={cn("max-w-full truncate text-muted-foreground leading-none", className)}>
      {spot}
    </p>
  ) : null
}

/** For a camera that will not scan: the address to type, always left to right. */
function ShortUrl({ url, className }: { url: string; className: string }) {
  return (
    <p dir="ltr" className={cn("max-w-full break-all text-center font-mono leading-tight", className)}>
      {printedUrl(url)}
    </p>
  )
}

function Perk({ perk, className }: { perk: { title: string; text: string }; className?: string }) {
  return (
    <div className={cn("w-full rounded-[3cqw] border border-brand-accent p-[2.5cqw]", className)}>
      <h2 className="font-semibold text-[1.15em] leading-snug" dir="auto">
        {perk.title}
      </h2>
      <p className="break-words leading-snug rtl:leading-normal" dir="auto">
        {perk.text}
      </p>
    </div>
  )
}

/** Room card and front desk sign: the same portrait layout, scaled by the paper width. */
function Portrait({ face }: { face: Face }) {
  const long = (face.perk?.text.length ?? 0) > LONG_PERK
  return (
    <div className="flex h-full flex-col items-center gap-[2.5cqw] p-[7cqw] text-center">
      <Brand hotel={face.hotel} className={long ? "text-[4.2cqw]" : "text-[5cqw]"} />
      <h1
        dir="auto"
        className={cn("text-balance font-display", long ? "text-[5.5cqw]" : "text-[7.5cqw]", "leading-tight")}
      >
        {face.headline}
      </h1>
      {/* the code takes the height the words leave, so a long translation or offer never runs off the paper */}
      <div className="flex min-h-[36cqw] w-full flex-1 flex-col items-center justify-center gap-[0.8cqw]">
        <Code face={face} className={cn("min-h-0 w-auto flex-1", face.perk ? "max-h-[52cqw]" : "max-h-[66cqw]")} />
        <ShortUrl url={face.code.url} className="text-[3cqw]" />
        <StaffLabel code={face.code} className="text-[2cqw]" />
      </div>
      <div>
        <p className={cn("font-semibold", long ? "text-[3.2cqw]" : "text-[4cqw]", "leading-snug")}>{face.words.scan}</p>
        <p className="text-[3cqw] text-muted-foreground">{face.words.noApp}</p>
      </div>
      {face.perk ? <Perk perk={face.perk} className={long ? "text-[2.6cqw]" : "text-[3.4cqw]"} /> : null}
    </div>
  )
}

/** One face of the table tent, A6 landscape. */
function TentFace({ face, className }: { face: Face; className?: string }) {
  const long = (face.perk?.text.length ?? 0) > LONG_PERK
  return (
    <div className={cn("flex h-1/2 items-center gap-[4cqw] p-[5cqw]", className)}>
      <div className="flex h-full min-w-0 flex-1 flex-col justify-between gap-[1.5cqw] text-start">
        <Brand hotel={face.hotel} className="text-[3cqw] [&_img]:size-[9cqw]" />
        <h1
          dir="auto"
          className={cn(
            "text-balance font-display leading-tight",
            long ? "text-[3.5cqw]" : face.perk ? "text-[5cqw]" : "text-[6.5cqw]",
          )}
        >
          {face.headline}
        </h1>
        {face.perk ? <Perk perk={face.perk} className={long ? "text-[1.8cqw]" : "text-[2.6cqw]"} /> : <span />}
      </div>
      <div className="flex w-[36cqw] shrink-0 flex-col items-center gap-[1.5cqw] text-center">
        <Code face={face} className="w-[35cqw] p-[2cqw]" />
        <ShortUrl url={face.code.url} className="text-[1.8cqw]" />
        <StaffLabel code={face.code} className="text-[1.4cqw]" />
        <p className="font-semibold text-[2.8cqw] leading-tight">{face.words.scan}</p>
        <p className="text-[2cqw] text-muted-foreground leading-tight">{face.words.noApp}</p>
      </div>
    </div>
  )
}

/**
 * One printed card. Everything stays inside a white safe margin, so a trim that is a little off never cuts content.
 * Sizes are `cqw`, so the thumbnail, the preview and the paper are the same drawing.
 */
export function CardArt({
  piece,
  hotel,
  code,
  className,
  ...text
}: CardText & { piece: CaptureSource; hotel: KitHotel; code: KitCode; className?: string }) {
  const face: Face = { ...text, hotel, code }
  return (
    <section
      lang={text.language}
      dir={getDirection(text.language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={brandStyle(hotel)}
      className={cn(
        "@container w-full shrink-0 break-inside-avoid overflow-hidden bg-white text-foreground [print-color-adjust:exact]",
        text.language === "ar" ? "font-arabic" : "font-sans",
        CARD_SIZES[piece].sheet,
        className,
      )}
    >
      {piece === "table" ? (
        <div className="flex h-full flex-col">
          {/* upside down, so it faces the other side once the sheet is folded */}
          <TentFace face={face} className="rotate-180 border-border border-t border-dashed" />
          <TentFace face={face} />
        </div>
      ) : (
        <Portrait face={face} />
      )}
    </section>
  )
}

/** All in mm. A 39 mm code scans from arm's length. */
export const STICKER = { width: 45, height: 52, code: 39 }

/** One sticker, in mm units. Standalone enough to be saved as an image (`lib/qr-download.ts`). */
export function StickerArt({
  hotel,
  code,
  language,
  words,
  ...props
}: {
  hotel: KitHotel
  code: KitCode
  language: HotelLanguage
  words: KitWords
} & Omit<React.SVGProps<SVGSVGElement>, "viewBox">) {
  const label = staffLabel(code.source, code.location) ?? ""
  const address = printedUrl(code.url)
  const middle = STICKER.width / 2
  return (
    <svg viewBox={`0 0 ${STICKER.width} ${STICKER.height}`} {...props}>
      <title>{words.alt}</title>
      <rect width={STICKER.width} height={STICKER.height} className="fill-white" />
      <QrMark
        svg={code.svg}
        hotel={hotel}
        label={label}
        x={(STICKER.width - STICKER.code) / 2}
        y={2}
        width={STICKER.code}
        height={STICKER.code}
      />
      <text
        x={middle}
        y={STICKER.code + 4.5}
        textAnchor="middle"
        fontSize="3.2"
        lang={language}
        direction={getDirection(language)}
        className={cn("fill-foreground font-semibold", language === "ar" ? "font-arabic" : "font-sans")}
      >
        {words.sheetScan}
      </text>
      <text
        x={middle}
        y={STICKER.code + 8}
        textAnchor="middle"
        fontSize="2.4"
        direction="ltr"
        className="fill-foreground font-mono"
        // a monospace letter is 0.6 em: a long host is squeezed to the sticker
        {...(address.length * 1.44 > STICKER.width - 4
          ? { textLength: STICKER.width - 4, lengthAdjust: "spacingAndGlyphs" }
          : {})}
      >
        {address}
      </text>
      <text
        x={middle}
        y={STICKER.code + 11}
        textAnchor="middle"
        fontSize="2.2"
        direction="ltr"
        className="fill-muted-foreground font-sans"
        // a long name is squeezed to the sticker instead of running into the next one
        {...(label.length > 24 ? { textLength: STICKER.width - 6, lengthAdjust: "spacingAndGlyphs" } : {})}
      >
        {label}
      </text>
    </svg>
  )
}

const PAGE = { width: 210, height: 297 }
const COLUMNS = 4
const ROWS = 5
const LEFT = (PAGE.width - COLUMNS * STICKER.width) / 2
const TOP = (PAGE.height - ROWS * STICKER.height) / 2
const MARK = { length: 8, gap: 2 }

export const STICKERS_PER_PAGE = COLUMNS * ROWS

const lines = (count: number, start: number, step: number) =>
  Array.from({ length: count + 1 }, (_, i) => start + i * step)

/** Short ticks in the margin at every cut line, so no line is ever printed on a sticker. */
function CropMarks() {
  const right = LEFT + COLUMNS * STICKER.width
  const bottom = TOP + ROWS * STICKER.height
  const near = MARK.gap
  const far = MARK.gap + MARK.length
  return (
    <path
      className="fill-none stroke-foreground"
      strokeWidth="0.2"
      d={[
        ...lines(COLUMNS, LEFT, STICKER.width).map(
          (x) => `M${x} ${TOP - far}V${TOP - near}M${x} ${bottom + near}V${bottom + far}`,
        ),
        ...lines(ROWS, TOP, STICKER.height).map(
          (y) => `M${LEFT - far} ${y}H${LEFT - near}M${right + near} ${y}H${right + far}`,
        ),
      ].join("")}
    />
  )
}

/** One A4 page of stickers with crop marks. */
export function StickerSheet({
  hotel,
  codes,
  language,
  words,
  className,
}: {
  hotel: KitHotel
  codes: KitCode[]
  language: HotelLanguage
  words: KitWords
  className?: string
}) {
  return (
    <svg
      viewBox={`0 0 ${PAGE.width} ${PAGE.height}`}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={brandStyle(hotel)}
      className={cn(
        "aspect-[210/297] w-full shrink-0 break-inside-avoid bg-white text-foreground [print-color-adjust:exact] print:h-[297mm] print:w-[210mm]",
        className,
      )}
    >
      <title>{words.alt}</title>
      <CropMarks />
      {codes.map((code, index) => (
        <StickerArt
          key={code.url}
          hotel={hotel}
          code={code}
          language={language}
          words={words}
          x={LEFT + (index % COLUMNS) * STICKER.width}
          y={TOP + Math.floor(index / COLUMNS) * STICKER.height}
          width={STICKER.width}
          height={STICKER.height}
        />
      ))}
    </svg>
  )
}
