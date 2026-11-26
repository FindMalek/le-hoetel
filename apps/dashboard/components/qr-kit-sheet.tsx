import { brandStyle } from "@ritorno/common/color"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { staffLabel } from "@ritorno/common/qr"
import type { CaptureSource } from "@ritorno/common/schemas"
import { getDirection } from "@ritorno/i18n"
import { cn } from "@ritorno/ui/lib/utils"
import { getTranslations } from "next-intl/server"
import { QrMark } from "@/components/qr-mark"

/** The paper each piece prints on, in mm. The table tent is one A5 sheet folded in half into two faces. */
export const KIT_PIECES = {
  room: { width: 105, height: 148, paper: "A6", sheet: "w-[105mm] aspect-[105/148] print:h-[148mm]" },
  table: { width: 148, height: 210, paper: "A5", sheet: "w-[148mm] aspect-[148/210] print:h-[210mm]" },
  desk: { width: 148, height: 210, paper: "A5", sheet: "w-[148mm] aspect-[148/210] print:h-[210mm]" },
} as const satisfies Record<CaptureSource, object>

// i18n-used: qrKit.headlineRoom
// i18n-used: qrKit.headlineTable
// i18n-used: qrKit.headlineDesk
const HEADLINES = { room: "headlineRoom", table: "headlineTable", desk: "headlineDesk" } as const

/** Past this length the perk text drops a size, so the longest offer (400 characters) still fits. */
const LONG_PERK = 160

export type KitHotel = {
  displayName: string
  logoSrc: string | null
  primaryColor: string | null
  accentColor: string | null
}

type Face = {
  hotel: KitHotel
  headline: string
  scan: string
  noApp: string
  perk: { title: string; text: string }
  /** The staff-only label of the spot, printed tiny under the code. */
  spot: string | null
  qr: { svg: string; alt: string }
}

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
      svg={face.qr.svg}
      hotel={face.hotel}
      label={face.qr.alt}
      className={cn(
        "aspect-square shrink-0 rounded-[3cqw] border-[0.8cqw] border-brand-accent bg-white p-[3cqw]",
        className,
      )}
    />
  )
}

function StaffLabel({ spot, className }: { spot: string | null; className: string }) {
  return spot ? (
    <p dir="ltr" className={cn("max-w-full truncate text-muted-foreground leading-none", className)}>
      {spot}
    </p>
  ) : null
}

function Perk({ perk, className }: { perk: Face["perk"]; className?: string }) {
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
  const long = face.perk.text.length > LONG_PERK
  return (
    <div className="flex h-full flex-col items-center gap-[2.5cqw] p-[7cqw] text-center">
      <Brand hotel={face.hotel} className={long ? "text-[4.2cqw]" : "text-[5cqw]"} />
      <h1 className={cn("text-balance font-display", long ? "text-[5.5cqw]" : "text-[7.5cqw]", "leading-tight")}>
        {face.headline}
      </h1>
      {/* the code takes the height the words leave, so a long translation or offer never runs off the paper */}
      <div className="flex min-h-[36cqw] w-full flex-1 flex-col items-center justify-center gap-[0.8cqw]">
        <Code face={face} className="min-h-0 w-auto max-h-[52cqw] flex-1" />
        <StaffLabel spot={face.spot} className="text-[2cqw]" />
      </div>
      <div>
        <p className={cn("font-semibold", long ? "text-[3.2cqw]" : "text-[4cqw]", "leading-snug")}>{face.scan}</p>
        <p className="text-[3cqw] text-muted-foreground">{face.noApp}</p>
      </div>
      <Perk perk={face.perk} className={long ? "text-[2.6cqw]" : "text-[3.4cqw]"} />
    </div>
  )
}

/** One face of the table tent, A6 landscape. */
function TentFace({ face, className }: { face: Face; className?: string }) {
  const long = face.perk.text.length > LONG_PERK
  return (
    <div className={cn("flex h-1/2 items-center gap-[4cqw] p-[5cqw]", className)}>
      <div className="flex h-full min-w-0 flex-1 flex-col justify-between gap-[1.5cqw] text-start">
        <Brand hotel={face.hotel} className="text-[3cqw] [&_img]:size-[9cqw]" />
        <h1 className={cn("text-balance font-display", long ? "text-[3.5cqw]" : "text-[5cqw]", "leading-tight")}>
          {face.headline}
        </h1>
        <Perk perk={face.perk} className={long ? "text-[1.8cqw]" : "text-[2.6cqw]"} />
      </div>
      <div className="flex w-[36cqw] shrink-0 flex-col items-center gap-[1.5cqw] text-center">
        <Code face={face} className="w-[35cqw] p-[2cqw]" />
        <StaffLabel spot={face.spot} className="text-[1.4cqw]" />
        <p className="font-semibold text-[2.8cqw] leading-tight">{face.scan}</p>
        <p className="text-[2cqw] text-muted-foreground leading-tight">{face.noApp}</p>
      </div>
    </div>
  )
}

/**
 * One printed page, in the language of the card, not of the dashboard. Everything stays inside a white safe margin, so
 * nothing needs bleed and a trim that is a little off never cuts content. Sizes are `cqw`, so the screen preview and
 * the paper are the same drawing.
 */
export async function QrKitSheet({
  piece,
  language,
  hotel,
  perk,
  code,
}: {
  piece: CaptureSource
  language: HotelLanguage
  hotel: KitHotel
  perk: { title: string; text: string } | null
  code: { location: string | null; svg: string }
}) {
  const t = await getTranslations({ locale: language, namespace: "qrKit" })
  const face: Face = {
    hotel,
    headline: t(HEADLINES[piece]),
    scan: t("scan"),
    noApp: t("noApp"),
    perk: {
      title: perk?.title ?? t("perkTitle"),
      text: perk?.text || t("perkBody", { hotel: hotel.displayName }),
    },
    spot: staffLabel(piece, code.location),
    qr: { svg: code.svg, alt: t("alt") },
  }
  const size = KIT_PIECES[piece]
  return (
    <section
      lang={language}
      dir={getDirection(language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={brandStyle(hotel)}
      className={cn(
        "@container max-w-full shrink-0 break-inside-avoid overflow-hidden bg-white text-foreground shadow-md [print-color-adjust:exact] print:max-w-none print:shadow-none print:[&:not(:last-child)]:break-after-page",
        language === "ar" ? "font-arabic" : "font-sans",
        size.sheet,
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
