import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { LOGO_NAME, logoMarkSvg, logoWordmarkSvg } from "@ritorno/ui/brand/logo"
import type { CSSProperties } from "react"
import { CLOUD, createSky } from "./pixel-sky-grid"

export interface OgColors {
  background: string
  foreground: string
  muted: string
  border: string
  accent: string
}

export interface OgFont {
  name: string
  data: Buffer
  weight: 400 | 600
  style: "normal" | "italic"
}

export const OG_SIZE = { width: 1200, height: 630 }

/** sRGB of --sky-1..4 and --cloud; satori can't read css variables. */
const SKY_PALETTE = ["#0a84ff", "#5aaeff", "#a9d4ff", "#dcefff", "#ffffff"]
const SKY_CELL = 15
const SKY_ROWS = 14
const SKY_COLS = OG_SIZE.width / SKY_CELL

const svgSrc = (svg: string): string => `data:image/svg+xml;base64,${btoa(svg)}`

/** The PixelSky grid as one svg, runs of a color merged into one rect so satori stays fast. */
function skyBandSvg(): string {
  const cells = createSky()({ cols: SKY_COLS, rows: SKY_ROWS, fadeTop: true })
  const rects: string[] = []
  for (let y = 0; y < SKY_ROWS; y++) {
    let x = 0
    while (x < SKY_COLS) {
      const color = cells[y * SKY_COLS + x] ?? CLOUD
      let end = x + 1
      while (end < SKY_COLS && cells[y * SKY_COLS + end] === color) end++
      if (color !== CLOUD) {
        rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${SKY_PALETTE[color]}"/>`)
      }
      x = end
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_SIZE.width}" height="${SKY_ROWS * SKY_CELL}" viewBox="0 0 ${SKY_COLS} ${SKY_ROWS}" shape-rendering="crispEdges">${rects.join("")}</svg>`
}

let skyBand: string | undefined

/**
 * Font files live in each app's `assets/`, read from the app root as the next/og docs do. Geist comes first so it is
 * the fallback for every other line. Satori measures words without kerning but draws them with it, so the files have
 * their kerning removed, or spaces come out uneven. The Naskh file is the v2 build with its one contextual rlig lookup
 * removed: opentype.js throws on GSUB 5.3 and can't shape the newer build's multiple substitution joins.
 */
export async function loadOgFonts(rtl = false): Promise<OgFont[]> {
  const file = (name: string) => readFile(join(process.cwd(), "assets", name))
  const display: OgFont = rtl
    ? { name: "Naskh", data: await file("noto-naskh-arabic-600.ttf"), weight: 600, style: "normal" }
    : { name: "Newsreader", data: await file("newsreader-italic-400.ttf"), weight: 400, style: "italic" }
  return [{ name: "Geist", data: await file("geist-400.ttf"), weight: 400, style: "normal" }, display]
}

/** First Presentation Forms-B code point (isolated form) of each letter; `R` letters only join the letter before them. */
const ARABIC_FORMS: Record<string, [number, "D" | "R"]> = {
  آ: [0xfe81, "R"],
  أ: [0xfe83, "R"],
  ؤ: [0xfe85, "R"],
  إ: [0xfe87, "R"],
  ئ: [0xfe89, "D"],
  ا: [0xfe8d, "R"],
  ب: [0xfe8f, "D"],
  ة: [0xfe93, "R"],
  ت: [0xfe95, "D"],
  ث: [0xfe99, "D"],
  ج: [0xfe9d, "D"],
  ح: [0xfea1, "D"],
  خ: [0xfea5, "D"],
  د: [0xfea9, "R"],
  ذ: [0xfeab, "R"],
  ر: [0xfead, "R"],
  ز: [0xfeaf, "R"],
  س: [0xfeb1, "D"],
  ش: [0xfeb5, "D"],
  ص: [0xfeb9, "D"],
  ض: [0xfebd, "D"],
  ط: [0xfec1, "D"],
  ظ: [0xfec5, "D"],
  ع: [0xfec9, "D"],
  غ: [0xfecd, "D"],
  ف: [0xfed1, "D"],
  ق: [0xfed5, "D"],
  ك: [0xfed9, "D"],
  ل: [0xfedd, "D"],
  م: [0xfee1, "D"],
  ن: [0xfee5, "D"],
  ه: [0xfee9, "D"],
  و: [0xfeed, "R"],
  ى: [0xfeef, "R"],
  ي: [0xfef1, "D"],
}
const LAM = "ل"
const TATWEEL = "ـ"
const LAM_ALEF: Record<string, number> = { آ: 0xfef5, أ: 0xfef7, إ: 0xfef9, ا: 0xfefb }
/** Harakat are dropped: satori places them on the wrong letter once the word is in visual order. */
const HARAKAT = /[ً-ٰٟ]/g

/**
 * Arabic as joined presentation forms in visual order. Satori sizes a word from its unjoined letters but draws it
 * joined, which leaves uneven gaps; with the joined forms already in the string both match. Satori lays presentation
 * forms out left to right, so the letters are reversed here.
 */
function shapeArabic(text: string): string {
  const chars = [...text.replace(HARAKAT, "")]
  const joinsForward = (char: string | undefined): boolean => char === TATWEEL || ARABIC_FORMS[char ?? ""]?.[1] === "D"
  const joins = (char: string | undefined): boolean => char === TATWEEL || ARABIC_FORMS[char ?? ""] !== undefined
  const glyphs: string[] = []
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i] ?? ""
    const form = ARABIC_FORMS[char]
    if (!form) {
      glyphs.push(char)
      continue
    }
    const before = joinsForward(chars[i - 1])
    const lamAlef = char === LAM ? LAM_ALEF[chars[i + 1] ?? ""] : undefined
    if (lamAlef !== undefined) {
      glyphs.push(String.fromCodePoint(lamAlef + (before ? 1 : 0)))
      i++
      continue
    }
    const after = form[1] === "D" && joins(chars[i + 1])
    const offset = form[1] === "R" ? Number(before) : before ? (after ? 3 : 1) : after ? 2 : 0
    glyphs.push(String.fromCodePoint(form[0] + offset))
  }
  return glyphs.reverse().join("")
}

/** Arabic goes word by word because satori reorders words when RTL text wraps. */
function Words({ text, gap, style }: { text: string; gap: number; style: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", flexWrap: "wrap", columnGap: gap, ...style }}>
      {text
        .split(/\s+/)
        .map(shapeArabic)
        .map((word, index) => (
          <div key={index} style={{ display: "flex" }}>
            {word}
          </div>
        ))}
    </div>
  )
}

/** Markup for next/og's ImageResponse: satori only takes inline styles and hex colors. */
export function OgCard({
  suffix,
  title,
  description,
  colors,
  rtl,
}: {
  /** Shown after the wordmark, like "docs". */
  suffix?: string
  title: string
  description?: string
  colors: OgColors
  rtl?: boolean
}) {
  skyBand ??= svgSrc(skyBandSvg())
  const align = rtl ? "flex-end" : "flex-start"
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: colors.background,
        color: colors.foreground,
        fontFamily: "Geist",
      }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: align, padding: "56px 72px 0" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "row", // the lockup reads mark then wordmark in every language, only its place follows the direction
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: colors.muted,
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: satori only draws images through img */}
          <img src={svgSrc(logoMarkSvg(52))} width={52} height={52} alt="" />
          {/* biome-ignore lint/performance/noImgElement: satori only draws images through img */}
          <img src={svgSrc(logoWordmarkSvg(30, colors.foreground))} height={30} alt={LOGO_NAME} />
          {suffix ? (
            <div style={{ display: "flex", marginTop: 4, paddingLeft: 16, borderLeft: `2px solid ${colors.border}` }}>
              {suffix}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 20, marginTop: 44 }}>
          {rtl ? (
            <Words
              text={title}
              gap={18}
              style={{ fontFamily: "Naskh", fontWeight: 600, fontSize: 64, lineHeight: 1.35, maxWidth: 1000 }}
            />
          ) : (
            <div
              style={{
                fontFamily: "Newsreader",
                fontStyle: "italic",
                fontSize: 76,
                lineHeight: 1.02,
                letterSpacing: -1.5,
                maxWidth: 1000,
              }}
            >
              {title}
            </div>
          )}
          {description ? (
            <div style={{ fontSize: 28, lineHeight: 1.4, color: colors.muted, maxWidth: 940 }}>{description}</div>
          ) : null}
        </div>
      </div>
      {/* biome-ignore lint/performance/noImgElement: satori only draws images through img */}
      <img src={skyBand} width={OG_SIZE.width} height={SKY_ROWS * SKY_CELL} alt="" />
    </div>
  )
}
