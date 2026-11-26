import { LOGO_NAME, logoMarkSvg, logoWordmarkSvg } from "@ritorno/ui/brand/logo"

export interface OgColors {
  background: string
  foreground: string
  muted: string
  border: string
  accent: string
}

export const OG_SIZE = { width: 1200, height: 630 }

const svgSrc = (svg: string): string => `data:image/svg+xml;base64,${btoa(svg)}`

/** Markup for next/og's ImageResponse: satori only takes inline styles and hex colors. Arabic is laid out word by word because satori reorders words when RTL text wraps. */
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
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 40,
        background: colors.background,
        color: colors.foreground,
        ...(rtl ? { fontFamily: "Cairo" } : {}),
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          border: `2px solid ${colors.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, color: colors.muted }}>
          {/* biome-ignore lint/performance/noImgElement: satori only draws images through img */}
          <img src={svgSrc(logoMarkSvg(56))} width={56} height={56} alt="" />
          {/* biome-ignore lint/performance/noImgElement: satori only draws images through img */}
          <img src={svgSrc(logoWordmarkSvg(29, colors.foreground))} height={29} alt={LOGO_NAME} />
          {suffix}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {rtl ? (
            <div
              style={{
                display: "flex",
                flexDirection: "row-reverse",
                flexWrap: "wrap",
                gap: 20,
                fontSize: 76,
                lineHeight: 1.3,
                maxWidth: 900,
              }}
            >
              {title.split(" ").map((word, index) => (
                <div key={index} style={{ display: "flex" }}>
                  {word}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
          )}
          {description ? (
            <div style={{ fontSize: 32, lineHeight: 1.35, color: colors.muted, maxWidth: 900 }}>{description}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
