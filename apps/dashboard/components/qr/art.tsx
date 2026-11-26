import { brandStyle } from "@ritorno/common/color"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { printedUrl, staffLabel } from "@ritorno/common/qr"
import type { CaptureSource } from "@ritorno/common/schemas"
import { getDirection } from "@ritorno/i18n"
import { cn } from "@ritorno/ui/lib/utils"
import { QrMark } from "@/components/qr-mark"
import { cropMarks, gridOf, type Layout, TRIM } from "./layout"

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
  sheetBenefit: string
}

export type CardText = {
  language: HotelLanguage
  words: KitWords
  headline: string
  /** `null` leaves the perk off. */
  perk: { title: string; text: string } | null
  /** The perk in one line, for stickers. */
  benefit: string | null
}

/** Past this length the perk text drops a size, so the longest offer (400 characters) still fits. */
const LONG_PERK = 160

type Face = CardText & { hotel: KitHotel; code: KitCode }

/** The hotel's color from edge to edge, running into the bleed so a cut that is a little off shows no white. */
function Brand({ hotel, className }: { hotel: KitHotel; className?: string }) {
  return (
    <header
      className={cn(
        "relative flex w-full shrink-0 items-center gap-[2.5cqw] px-[7cqw] py-[3.5cqw] text-start text-primary-foreground",
        className,
      )}
    >
      <span aria-hidden className="absolute -inset-x-(--bleed) -top-(--bleed) bottom-0 bg-primary" />
      {hotel.logoSrc ? (
        // biome-ignore lint/performance/noImgElement: a hotel upload, printed as is
        <img
          src={hotel.logoSrc}
          alt=""
          className="relative size-[13cqw] rounded-[2cqw] bg-white object-contain p-[1cqw]"
        />
      ) : null}
      <p className="relative min-w-0 flex-1 break-words font-semibold leading-tight">
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

/** Where the card goes, big enough to sort a stack of sixty by: for staff, in a corner. */
function StaffLabel({ code, className }: { code: KitCode; className: string }) {
  const spot = staffLabel(code.source, code.location)
  return spot ? (
    <p
      dir="ltr"
      className={cn(
        "absolute max-w-1/2 truncate rounded-[1.2cqw] border-[0.4cqw] border-foreground bg-white px-[2cqw] font-bold tabular-nums leading-snug",
        className,
      )}
    >
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
    <div className="flex h-full flex-col text-center">
      <Brand hotel={face.hotel} className={long ? "text-[4.2cqw]" : "text-[5.5cqw]"} />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center gap-[2.5cqw] px-[7cqw] pt-[3.5cqw]",
          face.code.location ? "pb-[12cqw]" : "pb-[6cqw]",
        )}
      >
        <h1
          dir="auto"
          className={cn("text-balance font-display", long ? "text-[5.5cqw]" : "text-[7.5cqw]", "leading-tight")}
        >
          {face.headline}
        </h1>
        {/* the code takes the height the words leave, so a long translation or offer never runs off the paper */}
        <div className="flex min-h-[34cqw] w-full flex-1 flex-col items-center justify-center gap-[0.8cqw]">
          <Code face={face} className={cn("min-h-0 w-auto flex-1", face.perk ? "max-h-[52cqw]" : "max-h-[66cqw]")} />
          <ShortUrl url={face.code.url} className="text-[3cqw]" />
        </div>
        <div>
          <p className={cn("font-semibold", long ? "text-[3.2cqw]" : "text-[4cqw]", "leading-snug")}>
            {face.words.scan}
          </p>
          <p className="text-[3cqw] text-muted-foreground">{face.words.noApp}</p>
        </div>
        {face.perk ? <Perk perk={face.perk} className={long ? "text-[2.6cqw]" : "text-[3.4cqw]"} /> : null}
      </div>
      <StaffLabel code={face.code} className="end-[7cqw] bottom-[2.5cqw] text-[4.5cqw]" />
    </div>
  )
}

/** One face of the table tent, A6 landscape, its band on the ridge of the folded sheet. */
function TentFace({ face, className }: { face: Face; className?: string }) {
  const long = (face.perk?.text.length ?? 0) > LONG_PERK
  return (
    <div className={cn("relative flex h-1/2 flex-col", className)}>
      <Brand hotel={face.hotel} className="px-[5cqw] py-[2cqw] text-[3.5cqw] [&_img]:size-[8cqw]" />
      <div className="flex min-h-0 flex-1 items-center gap-[4cqw] px-[5cqw] py-[2.5cqw]">
        <div className="flex h-full min-w-0 flex-1 flex-col justify-center gap-[3cqw] pb-[5cqw] text-start">
          <h1
            dir="auto"
            className={cn(
              "text-balance font-display leading-tight",
              long ? "text-[3.5cqw]" : face.perk ? "text-[5cqw]" : "text-[6.5cqw]",
            )}
          >
            {face.headline}
          </h1>
          {face.perk ? <Perk perk={face.perk} className={long ? "text-[1.8cqw]" : "text-[2.6cqw]"} /> : null}
        </div>
        <div className="flex w-[34cqw] shrink-0 flex-col items-center gap-[1cqw] text-center">
          <Code face={face} className="w-[31cqw] p-[2cqw]" />
          <ShortUrl url={face.code.url} className="text-[1.8cqw]" />
          <p className="font-semibold text-[2.8cqw] leading-tight">{face.words.scan}</p>
          <p className="text-[2cqw] text-muted-foreground leading-tight">{face.words.noApp}</p>
        </div>
      </div>
      <StaffLabel code={face.code} className="start-[5cqw] bottom-[2cqw] text-[3.2cqw]" />
    </div>
  )
}

/**
 * One card, filling its box. Words and codes stay inside a safe margin, only the color runs to the edge and on into
 * `bleed`. Sizes are `cqw`, so the thumbnail, the preview and the paper are the same drawing.
 */
export function CardArt({
  piece,
  hotel,
  code,
  bleed = 0,
  ...text
}: CardText & { piece: CaptureSource; hotel: KitHotel; code: KitCode; bleed?: number }) {
  const face: Face = { ...text, hotel, code }
  return (
    <section
      lang={text.language}
      dir={getDirection(text.language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={{ ...brandStyle(hotel), "--bleed": `${(bleed / TRIM[piece].width) * 100}cqw` } as React.CSSProperties}
      className={cn(
        "@container relative size-full bg-white text-foreground",
        text.language === "ar" ? "font-arabic" : "font-sans",
      )}
    >
      {piece === "table" ? (
        <div className="relative flex h-full flex-col">
          {/* upside down, so it faces the other side once the sheet is folded */}
          <TentFace face={face} className="rotate-180" />
          <TentFace face={face} />
          <span aria-hidden className="absolute inset-x-0 top-1/2 border-primary-foreground border-t border-dashed" />
        </div>
      ) : (
        <Portrait face={face} />
      )}
    </section>
  )
}

/** The drawing of one sticker, in its own units: the large one is the same drawing scaled up. */
const STICKER = { width: TRIM.small.width, height: TRIM.small.height, code: 30 }

const RTL_LETTERS = /[\u0590-\u08FF]/

/** Words a hotel typed, on one line of a sticker: squeezed a little when long, cut when far too long. */
function Line({
  text,
  size,
  room,
  ...props
}: { text: string; size: number; room: number } & React.SVGProps<SVGTextElement>) {
  // a letter of this font is about 0.55 em wide
  const fits = Math.floor(room / (size * 0.55))
  const letters = Array.from(text)
  const most = Math.floor(fits * 1.4)
  const shown = letters.length > most ? `${letters.slice(0, most - 1).join("")}…` : text
  return (
    <text
      x={STICKER.width / 2}
      textAnchor="middle"
      fontSize={size}
      direction={RTL_LETTERS.test(text) ? "rtl" : "ltr"}
      {...(letters.length > fits ? { textLength: room, lengthAdjust: "spacingAndGlyphs" } : {})}
      {...props}
    >
      {shown}
    </text>
  )
}

/** One sticker. Standalone enough to be saved as an image (`lib/qr-download.ts`). */
export function StickerArt({
  hotel,
  code,
  language,
  words,
  benefit,
  className,
  ...props
}: {
  hotel: KitHotel
  code: KitCode
  language: HotelLanguage
  words: KitWords
  benefit: string | null
} & Omit<React.SVGProps<SVGSVGElement>, "viewBox">) {
  const label = staffLabel(code.source, code.location)
  const font = language === "ar" ? "font-arabic" : "font-sans"
  return (
    <svg
      viewBox={`0 0 ${STICKER.width} ${STICKER.height}`}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={brandStyle(hotel)}
      className={cn("block text-foreground", className)}
      {...props}
    >
      <title>{words.alt}</title>
      <rect width={STICKER.width} height={STICKER.height} className="fill-white" />
      <rect x="2.5" y="1.5" width={STICKER.width - 5} height="6" rx="3" className="fill-primary" />
      <Line
        text={hotel.displayName}
        size={3.1}
        room={STICKER.width - 9}
        y="4.6"
        dominantBaseline="central"
        className={cn("fill-primary-foreground font-semibold", font)}
      />
      <QrMark
        svg={code.svg}
        hotel={hotel}
        label={words.alt}
        x={(STICKER.width - STICKER.code) / 2}
        y={8}
        width={STICKER.code}
        height={STICKER.code}
      />
      {benefit ? (
        <Line
          text={benefit}
          size={2.7}
          room={STICKER.width - 5}
          y="40.9"
          className={cn("fill-foreground font-semibold", font)}
        />
      ) : null}
      <Line
        text={words.sheetScan}
        size={2.3}
        room={STICKER.width - 5}
        y="44"
        lang={language}
        className={cn("fill-foreground", font)}
      />
      <Line
        text={printedUrl(code.url)}
        size={2}
        room={STICKER.width - 4}
        y="46.8"
        className="fill-foreground font-mono"
      />
      {label ? (
        <Line
          text={label}
          size={3.6}
          room={STICKER.width - 8}
          y="50.8"
          className="fill-foreground font-bold font-sans"
        />
      ) : null}
    </svg>
  )
}

const percent = (part: number, whole: number) => `${(part / whole) * 100}%`

/** One printed page: the pieces where the layout puts them, and the crop marks around them. */
export function Sheet({
  piece,
  layout,
  codes,
  hotel,
  text,
  className,
}: {
  piece: Piece
  layout: Layout
  codes: KitCode[]
  hotel: KitHotel
  text: CardText
  className?: string
}) {
  const { page, cell, columns } = layout
  const { lefts, tops } = gridOf(layout)
  return (
    <div
      dir="ltr"
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={
        {
          "--page-width": `${page.width}mm`,
          "--page-height": `${page.height}mm`,
          aspectRatio: `${page.width} / ${page.height}`,
        } as React.CSSProperties
      }
      className={cn(
        "relative w-full shrink-0 break-inside-avoid overflow-hidden bg-white text-foreground [print-color-adjust:exact] print:h-(--page-height) print:w-(--page-width)",
        className,
      )}
    >
      {codes.map((code, index) => (
        <div
          // two copies of the desk sign share a code
          // biome-ignore lint/suspicious/noArrayIndexKey: the position on the page is the identity
          key={index}
          className="absolute"
          // oxlint-disable-next-line shadcn/no-inline-styles
          style={{
            insetInlineStart: percent(lefts[index % columns]!, page.width),
            top: percent(tops[Math.floor(index / columns)]!, page.height),
            width: percent(cell.width, page.width),
            height: percent(cell.height, page.height),
          }}
        >
          {piece === "sticker" ? (
            <StickerArt
              hotel={hotel}
              code={code}
              language={text.language}
              words={text.words}
              benefit={text.benefit}
              className="size-full"
            />
          ) : (
            <CardArt piece={piece} hotel={hotel} code={code} bleed={layout.bleed} {...text} />
          )}
        </div>
      ))}
      <svg
        aria-hidden
        viewBox={`0 0 ${page.width} ${page.height}`}
        className="pointer-events-none absolute inset-0 size-full"
      >
        <path d={cropMarks(layout)} className="fill-none stroke-foreground" strokeWidth="0.2" />
      </svg>
    </div>
  )
}
