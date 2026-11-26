"use client"

import { brandStyle } from "@ritorno/common/color"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { type PrintWarning, printWarnings } from "@ritorno/common/qr"
import { CAPTURE_SOURCES, type CaptureSource, type Spot, type SpotSource } from "@ritorno/common/schemas"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { orpc } from "@ritorno/orpc/react"
import { Button, buttonVariants } from "@ritorno/ui/components/button"
import { type DataColumn, DataTable } from "@ritorno/ui/components/data-table"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@ritorno/ui/components/dialog"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { FormField } from "@ritorno/ui/components/form-field"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { Section } from "@ritorno/ui/components/section"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { Switch } from "@ritorno/ui/components/switch"
import { cn } from "@ritorno/ui/lib/utils"
import { useQueries, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExternalLinkIcon,
  PrinterIcon,
  QrCodeIcon,
  RotateCwIcon,
  SmartphoneIcon,
} from "lucide-react"
import type { Route } from "next"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { logoSrc } from "@/lib/admin"
import { downloadArt, type ImageFormat } from "@/lib/qr-download"
import {
  CardArt,
  type CardText,
  type KitCode,
  type KitHotel,
  type KitWords,
  type Piece,
  Sheet,
  StickerArt,
} from "./art"
import { type Layout, layoutFor, type Paper, type StickerSize, TRIM } from "./layout"
import { chosenSpots, EVERY_SPOT, type Selection, SpotPicker } from "./spot-picker"

// i18n-used: qrCodes.pieceRoom
// i18n-used: qrCodes.pieceTable
// i18n-used: qrCodes.pieceDesk
// i18n-used: qrCodes.pieceSticker
// i18n-used: qrCodes.paperRoom
// i18n-used: qrCodes.paperTable
// i18n-used: qrCodes.paperDesk
// i18n-used: qrCodes.paperSticker
const PIECES = {
  room: { label: "pieceRoom", paper: "paperRoom", spots: ["room"] },
  table: { label: "pieceTable", paper: "paperTable", spots: ["table"] },
  desk: { label: "pieceDesk", paper: "paperDesk", spots: [] },
  sticker: { label: "pieceSticker", paper: "paperSticker", spots: ["room", "table"] },
} as const satisfies Record<Piece, { label: string; paper: string; spots: readonly SpotSource[] }>
const PIECE_KEYS = Object.keys(PIECES) as Piece[]

/** The most names `hotel.qrCodes` takes in one call. */
const BATCH = 100
const MAX_HEADLINE = 50

// i18n-used: qrCodes.warn_noOffer
// i18n-used: qrCodes.warn_offerExpires
// i18n-used: qrCodes.warn_noLogo
const WARNING_LINKS: Record<PrintWarning, Route> = {
  noOffer: "/offers",
  offerExpires: "/offers",
  noLogo: "/hotel#logo" as Route,
}

const chunks = <T,>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

const keyOf = (source: CaptureSource, location: string | null) => `${source}:${location ?? ""}`

type Target = { source: CaptureSource; location: string | null }

/** What the selection prints. A piece nobody saved a spot for still prints one code without a spot. */
function targetsOf(piece: Piece, saved: Spot[], selection: Selection): Target[] {
  if (piece === "desk") return [{ source: "desk", location: null }]
  if (!saved.length) return [{ source: piece === "sticker" ? "desk" : piece, location: null }]
  return chosenSpots(saved, selection).map((spot) => ({ source: spot.source, location: spot.name }))
}

/** Every code of the piece, asked for once: ticking spots on and off then costs no request. */
function useCodes(piece: Piece, saved: Spot[]) {
  const sources: CaptureSource[] = saved.length
    ? [...new Set(saved.map((spot) => spot.source))]
    : [piece === "sticker" ? "desk" : piece]
  const inputs = sources.flatMap((source) => {
    const names = saved.filter((spot) => spot.source === source).map((spot) => spot.name)
    return (names.length ? chunks(names, BATCH) : [[]]).map((spots) => ({ source, spots }))
  })
  return useQueries({
    queries: inputs.map((input) => orpc.hotel.qrCodes.queryOptions({ input, staleTime: Number.POSITIVE_INFINITY })),
    combine: (results) => ({
      codes: new Map(
        results.flatMap((result, index) => {
          const source = inputs[index]!.source
          return (result.data ?? []).map((code) => [keyOf(source, code.location), { ...code, source }] as const)
        }),
      ),
      pending: results.some((result) => result.isPending),
      failed: results.some((result) => result.isError),
      retry: () => {
        for (const result of results) if (result.isError) result.refetch()
      },
    }),
  })
}

/** Waits for the Arabic font and the logos, else the first print can go out with a fallback font or a blank logo. */
async function settled(root: ParentNode) {
  await document.fonts.ready
  // `img` misses the logos and codes drawn inside an svg
  const sources = [...root.querySelectorAll("img, svg image")].map(
    (element) => element.getAttribute("src") ?? element.getAttribute("href"),
  )
  await Promise.all(
    sources.map((src) =>
      Object.assign(new Image(), { src })
        .decode()
        .catch(() => undefined),
    ),
  )
}

type Drawing = { piece: Piece; layout: Layout; hotel: KitHotel; text: CardText }

/** Only on paper: every page of the selection, straight under `body` so nothing of the dashboard prints. */
function PrintPages({
  asked,
  onPrint,
  pages,
  fileName,
  ...drawing
}: Drawing & { asked: boolean; onPrint: () => void; pages: KitCode[][]; fileName: string }) {
  const root = useRef<HTMLDivElement>(null)
  // read by the effect, which runs once per click and not again when the selection changes
  const job = useRef({ fileName, onPrint })
  job.current = { fileName, onPrint }
  useEffect(() => {
    if (!asked || !root.current) return
    const { fileName, onPrint } = job.current
    // taken at once: switching pieces remounts this, and that must not print again
    onPrint()
    const title = document.title
    settled(root.current).then(() => {
      // the document title is the file name the browser offers on "Save as PDF"
      document.title = fileName
      addEventListener("afterprint", () => (document.title = title), { once: true })
      window.print()
    })
  }, [asked])
  return createPortal(
    <div ref={root} data-print-root className="hidden print:block">
      {/* the paper size depends on the piece, so it cannot live in the theme css */}
      {/* oxlint-disable-next-line shadcn/no-inline-styles */}
      <style>{`@page { size: ${drawing.layout.page.width}mm ${drawing.layout.page.height}mm; margin: 0 }
@media print { body { padding: 0 !important; min-height: 0 !important } body > :not([data-print-root]) { display: none !important } }`}</style>
      {pages.map((codes) => (
        <Sheet
          key={codes[0]!.url}
          {...drawing}
          codes={codes}
          className="print:[&:not(:last-of-type)]:break-after-page"
        />
      ))}
    </div>,
    document.body,
  )
}

/** Draws the art off screen, saves it, and goes. */
function SaveImages({
  format,
  codes,
  hotel,
  text,
  zipName,
  onDone,
}: {
  format: ImageFormat
  codes: KitCode[]
  hotel: KitHotel
  text: CardText
  zipName: string
  onDone: (failed: boolean) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const job = useRef({ format, codes, zipName, onDone })
  const started = useRef(false)
  useEffect(() => {
    // strict mode runs effects twice: one download is enough
    if (started.current) return
    started.current = true
    const { format, codes, zipName, onDone } = job.current
    const nodes = [...(root.current?.querySelectorAll<SVGSVGElement>("[data-art]") ?? [])]
    const art = nodes.map((node, index) => ({ ...codes[index]!, node }))
    document.fonts.ready
      .then(() => downloadArt(art, format, zipName))
      .then(
        () => onDone(false),
        () => onDone(true),
      )
  }, [])
  return (
    // oxlint-disable-next-line shadcn/no-inline-styles
    <div ref={root} aria-hidden style={brandStyle(hotel)} className="absolute size-0 overflow-hidden font-sans">
      {codes.map((code) => (
        <StickerArt
          key={code.url}
          data-art
          hotel={hotel}
          code={code}
          language={text.language}
          words={text.words}
          benefit={text.benefit}
        />
      ))}
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <h2 className="flex items-center gap-2 font-heading font-semibold text-lg tracking-tight">
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-primary text-caption text-primary-foreground"
        >
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

const thumbRatio = (piece: Piece) => {
  const { width, height } = TRIM[piece === "sticker" ? "small" : piece]
  return `${width} / ${height}`
}

function PiecePicker({
  piece,
  onChange,
  sample,
  hotel,
  text,
}: {
  piece: Piece
  onChange: (piece: Piece) => void
  sample: KitCode | undefined
  hotel: KitHotel
  text: CardText
}) {
  const t = useTranslations("qrCodes")
  return (
    <div role="radiogroup" aria-label={t("stepPiece")} className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-2">
      {PIECE_KEYS.map((item) => (
        <label
          key={item}
          className="flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-1.5 text-center sm:gap-2 sm:rounded-card sm:p-3 has-checked:border-primary has-checked:ring-1 has-checked:ring-primary has-focus-visible:ring-2 has-focus-visible:ring-ring"
        >
          <input
            type="radio"
            name="piece"
            className="sr-only"
            checked={piece === item}
            onChange={() => onChange(item)}
          />
          {/* a thumbnail is the art itself, drawn small */}
          <span aria-hidden className="flex h-20 w-full sm:h-32 items-center justify-center rounded-lg bg-surface">
            {sample ? (
              <span
                className={cn("block overflow-hidden shadow-xs", item === "room" ? "w-10 sm:w-16" : "w-12 sm:w-20")}
                // oxlint-disable-next-line shadcn/no-inline-styles
                style={{ aspectRatio: thumbRatio(item) }}
              >
                {item === "sticker" ? (
                  <StickerArt
                    hotel={hotel}
                    code={sample}
                    language={text.language}
                    words={text.words}
                    benefit={text.benefit}
                    className="size-full"
                  />
                ) : (
                  <CardArt piece={item} hotel={hotel} code={sample} {...text} />
                )}
              </span>
            ) : (
              <Skeleton className="h-16 w-12 sm:h-24 sm:w-16" />
            )}
          </span>
          <span className="flex flex-col">
            <span className="font-medium text-caption leading-tight sm:text-sm">{t(PIECES[item].label)}</span>
            <span className="text-caption text-muted-foreground max-sm:hidden">{t(PIECES[item].paper)}</span>
          </span>
        </label>
      ))}
    </div>
  )
}

function TestPage({ target, language }: { target: Target; language: HotelLanguage }) {
  const t = useTranslations("qrCodes")
  const [open, setOpen] = useState(false)
  const link = useQuery(
    orpc.hotel.testLink.queryOptions({
      input: { source: target.source, location: target.location ?? undefined, language },
    }),
  )
  const url = link.data?.url
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!url}
        className={cn(buttonVariants({ variant: "outline" }), "min-h-touch")}
      >
        <ExternalLinkIcon data-icon="inline-start" className="rtl:-scale-x-100" />
        {t("openPage")}
      </a>
      <Button variant="outline" className="min-h-touch" disabled={!url} onClick={() => setOpen(true)}>
        <SmartphoneIcon data-icon="inline-start" />
        {t("testPhone")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="justify-items-center text-center">
          <DialogTitle>{t("testPhone")}</DialogTitle>
          <DialogDescription>{t("testHint")}</DialogDescription>
          {link.data ? (
            <>
              {/* biome-ignore lint/performance/noImgElement: a generated data url, nothing to optimize */}
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(link.data.svg)}`}
                alt={t("testAlt")}
                className="aspect-square w-56 rounded-lg border bg-white"
              />
              <p dir="ltr" className="select-all break-all font-mono text-caption text-muted-foreground">
                {link.data.url}
              </p>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function Stats() {
  const t = useTranslations("qrCodes")
  const { data: stats } = useSuspenseQuery(orpc.hotel.captureStats.queryOptions())
  // i18n-used: qrCodes.room
  // i18n-used: qrCodes.table
  // i18n-used: qrCodes.desk
  const labelOf = (stored: string) => {
    const source = (Object.keys(CAPTURE_SOURCES) as CaptureSource[]).find((key) => CAPTURE_SOURCES[key] === stored)
    return source ? t(source) : stored
  }
  const columns: DataColumn<(typeof stats)[number]>[] = [
    { id: "spot", header: t("colSpot"), cell: (row) => row.location ?? t("noSpot") },
    { id: "where", header: t("colWhere"), cell: (row) => labelOf(row.source) },
    { id: "guests", header: t("colGuests"), align: "end", cell: (row) => row.guests },
  ]
  return (
    <Section title={t("tableTitle")} description={t("tableDescription")}>
      <DataTable
        caption={t("tableTitle")}
        columns={columns}
        rows={stats}
        getRowKey={(row) => `${row.source}-${row.location}`}
        empty={<EmptyState icon={<QrCodeIcon />} title={t("emptyTitle")} description={t("empty")} />}
      />
    </Section>
  )
}

export function QrStudio({ words }: { words: Record<HotelLanguage, KitWords> }) {
  const t = useTranslations("qrCodes")
  const locale = useLocale()
  const { data: hotel } = useSuspenseQuery(orpc.hotel.get.queryOptions())
  const { data: spots } = useSuspenseQuery(orpc.hotel.spots.list.queryOptions())
  const { data: offer } = useSuspenseQuery(orpc.hotel.welcomeOffer.queryOptions())

  const [piece, setPiece] = useState<Piece>(() => (spots.some((spot) => spot.source === "room") ? "room" : "desk"))
  const [selection, setSelection] = useState<Selection>(EVERY_SPOT)
  const [language, setLanguage] = useState<HotelLanguage>(hotel.defaultLanguage)
  const [headlines, setHeadlines] = useState<Record<string, string>>({})
  const [showPerk, setShowPerk] = useState(true)
  const [paper, setPaper] = useState<Paper>("office")
  const [stickers, setStickers] = useState<StickerSize>("small")
  const [page, setPage] = useState(0)
  const [asked, setAsked] = useState(false)
  const [saving, setSaving] = useState<ImageFormat | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const saved = spots.filter((spot) => (PIECES[piece].spots as readonly CaptureSource[]).includes(spot.source))
  const targets = targetsOf(piece, saved, selection)
  const { codes, pending, failed, retry } = useCodes(piece, saved)
  const printed = targets.flatMap((target) => codes.get(keyOf(target.source, target.location)) ?? [])
  const layout = layoutFor(piece, paper, stickers)
  const perPage = layout.columns * layout.rows
  // the one desk sign fills its sheet with copies, so no half page goes to waste
  const placed = piece === "desk" ? printed.flatMap((code) => Array<KitCode>(perPage).fill(code)) : printed
  const pages = chunks(placed, perPage)
  const shown = Math.min(page, Math.max(pages.length - 1, 0))
  const ready = !pending && !failed && printed.length > 0

  const brand: KitHotel = {
    displayName: hotel.displayName,
    logoSrc: logoSrc(hotel.logoKey),
    primaryColor: hotel.primaryColor,
    accentColor: hotel.accentColor,
  }
  const cardWords = words[language]
  const headlineKey = piece === "sticker" ? null : `${piece}:${language}`
  const custom = headlineKey ? (headlines[headlineKey] ?? "") : ""
  const text: CardText = {
    language,
    words: cardWords,
    headline: custom.trim() || cardWords.headlines[piece === "sticker" ? "desk" : piece],
    perk: showPerk ? { title: offer?.title ?? cardWords.perkTitle, text: offer?.text || cardWords.perkBody } : null,
    benefit: showPerk ? (offer?.title ?? cardWords.sheetBenefit) : null,
  }
  const drawing: Drawing = { piece, layout, hotel: brand, text }
  const fileName = `${hotel.slug}-${piece}-${language}${paper === "shop" ? "-print-shop" : ""}`
  const ratio = layout.page.width / layout.page.height
  const expires = offer?.validUntil
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: hotel.timezone,
        numberingSystem: "latn",
      }).format(offer.validUntil)
    : ""

  const warnings = printWarnings(hotel, offer, new Date())

  const printButton = (
    <Button size="lg" className="min-h-touch" disabled={!ready} onClick={() => setAsked(true)}>
      <PrinterIcon data-icon="inline-start" />
      {t("print", { count: pages.length })}
    </Button>
  )

  return (
    <div className="flex flex-col gap-12">
      <div className="grid gap-8 lg:grid-cols-[24rem_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-10">
        <Step number={1} title={t("stepPiece")}>
          <PiecePicker
            piece={piece}
            onChange={(next) => {
              setPiece(next)
              setPage(0)
            }}
            sample={printed[0] ?? codes.values().next().value}
            hotel={brand}
            text={{ ...text, headline: cardWords.headlines.desk }}
          />
        </Step>

        <section
          aria-label={t("previewTitle")}
          className="flex min-w-0 flex-col gap-3 self-start lg:sticky lg:top-20 lg:col-start-2 lg:row-span-3 lg:row-start-1"
        >
          {warnings.length ? (
            <InlineAlert tone="warning" title={t("beforePrint")}>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>
                    {t(`warn_${warning}`, { date: expires })}{" "}
                    <Link
                      href={WARNING_LINKS[warning]}
                      className="font-medium text-foreground underline coarse:inline-flex coarse:min-h-touch coarse:items-center"
                    >
                      {warning === "noLogo" ? t("fixLogo") : t("fixOffer")}
                    </Link>
                  </li>
                ))}
              </ul>
            </InlineAlert>
          ) : null}
          <SegmentedControl
            label={t("paperLabel")}
            block
            value={paper}
            onValueChange={(next) => {
              setPaper(next)
              setPage(0)
            }}
            options={[
              { value: "office", label: t("paperOffice") },
              { value: "shop", label: t("paperShop") },
            ]}
          />
          {piece === "sticker" ? (
            <SegmentedControl
              label={t("stickerSize")}
              block
              value={stickers}
              onValueChange={(next) => {
                setStickers(next)
                setPage(0)
              }}
              options={[
                { value: "small", label: t("stickerSmall") },
                { value: "large", label: t("stickerLarge") },
              ]}
            />
          ) : null}
          <div className="flex flex-col items-center gap-3 rounded-card bg-surface p-4 md:p-6">
            <div className="flex w-full items-center justify-between gap-2">
              <h2 className="font-medium text-sm">{t("previewTitle")}</h2>
              {pages.length > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("previousPage")}
                    disabled={shown === 0}
                    onClick={() => setPage(shown - 1)}
                  >
                    <ChevronLeftIcon className="rtl:rotate-180" />
                  </Button>
                  <p aria-live="polite" className="text-sm tabular-nums">
                    {t("pageOf", { page: shown + 1, total: pages.length })}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("nextPage")}
                    disabled={shown >= pages.length - 1}
                    onClick={() => setPage(shown + 1)}
                  >
                    <ChevronRightIcon className="rtl:rotate-180" />
                  </Button>
                </div>
              ) : null}
            </div>
            {failed ? (
              <InlineAlert
                tone="error"
                title={t("failed")}
                action={
                  <Button size="sm" variant="outline" onClick={retry}>
                    <RotateCwIcon data-icon="inline-start" />
                    {t("retry")}
                  </Button>
                }
              >
                {t("failedHint")}
              </InlineAlert>
            ) : pending ? (
              <div role="status" aria-busy="true" className="w-full max-w-xs">
                <span className="sr-only">{t("generating")}</span>
                <Skeleton className="aspect-[105/148] w-full" />
              </div>
            ) : pages[shown] ? (
              <div
                data-preview
                // short enough to be seen whole above the consent card and the page chrome
                className="w-full max-w-(--preview-width) shadow-md"
                style={
                  {
                    "--preview-width": `clamp(14rem, calc((100dvh - var(--consent-banner-height, 0px) - 24rem) * ${ratio}), ${ratio > 1 ? "36rem" : "24rem"})`,
                  } as React.CSSProperties
                }
              >
                <Sheet {...drawing} codes={pages[shown]} />
              </div>
            ) : (
              <EmptyState icon={<QrCodeIcon />} title={t("nothingTitle")} description={t("nothing")} />
            )}
            {piece === "table" ? <p className="text-center text-muted-foreground text-sm">{t("foldHint")}</p> : null}
          </div>
          <div className="hidden flex-col gap-1 lg:flex">{printButton}</div>
          <p className="text-center text-muted-foreground text-sm">
            {paper === "office"
              ? t("printHintOffice")
              : t("printHintShop", { size: `${layout.cell.width} x ${layout.cell.height} mm` })}
          </p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {targets[0] ? <TestPage target={targets[0]} language={language} /> : null}
            {(["png", "svg"] as const).map((format) => (
              <Button
                key={format}
                variant="outline"
                className="min-h-touch"
                disabled={!ready || saving !== null}
                loading={saving === format}
                onClick={() => setSaving(format)}
              >
                <DownloadIcon data-icon="inline-start" />
                {t("saveImages", { format: format.toUpperCase() })}
              </Button>
            ))}
          </div>
        </section>

        {PIECES[piece].spots.length ? (
          <Step number={2} title={t("stepSpots")}>
            <SpotPicker
              sources={PIECES[piece].spots}
              saved={saved}
              selection={selection}
              onChange={(next) => {
                setSelection(next)
                setPage(0)
              }}
            />
          </Step>
        ) : (
          <Step number={2} title={t("stepSpots")}>
            <p className="text-muted-foreground text-sm">{t("deskOnly")}</p>
          </Step>
        )}

        <Step number={3} title={t("stepWords")}>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-sm">{t("language")}</span>
            <SegmentedControl
              label={t("language")}
              block
              value={language}
              onValueChange={setLanguage}
              options={HOTEL_LANGUAGES.map((item) => ({ value: item, label: LOCALE_NAMES[item] }))}
            />
          </div>
          {headlineKey ? (
            <FormField id="headline" label={t("headline")}>
              {(aria) => (
                <Input
                  {...aria}
                  dir="auto"
                  maxLength={MAX_HEADLINE}
                  value={custom}
                  placeholder={cardWords.headlines[piece === "sticker" ? "desk" : piece]}
                  onChange={(event) => setHeadlines({ ...headlines, [headlineKey]: event.target.value })}
                />
              )}
            </FormField>
          ) : null}
          {/* biome-ignore lint/a11y/noLabelWithoutControl: the switch inside is the control */}
          <label className="flex min-h-touch cursor-pointer items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="font-medium text-sm">{t("showPerk")}</span>
              <span className="text-muted-foreground text-sm">
                <bdi>{offer?.title ?? (piece === "sticker" ? cardWords.sheetBenefit : cardWords.perkTitle)}</bdi>
              </span>
            </span>
            <Switch checked={showPerk} onCheckedChange={setShowPerk} />
          </label>
        </Step>

        <StickyFormActions className="lg:hidden">{printButton}</StickyFormActions>
      </div>

      <Stats />

      {mounted && ready ? (
        <PrintPages asked={asked} onPrint={() => setAsked(false)} pages={pages} fileName={fileName} {...drawing} />
      ) : null}
      {saving ? (
        <SaveImages
          format={saving}
          codes={printed}
          hotel={brand}
          text={text}
          zipName={`${fileName}-${saving}.zip`}
          onDone={(error) => {
            setSaving(null)
            if (error) toast.error(t("saveFailed"))
          }}
        />
      ) : null}
    </div>
  )
}
