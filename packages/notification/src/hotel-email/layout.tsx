import { Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from "@react-email/components"
import { contrastRatio, MIN_UI_CONTRAST, readableForeground } from "@ritorno/common/color"
import { htmlAttributes, type Locale } from "@ritorno/i18n/config"
import type { CSSProperties, ReactNode } from "react"
import { BRAND, brandFonts } from "../brand"
import { PillButton } from "../templates/primitives"
import type { Copy } from "./copy"
import { fill } from "./copy"
import type { EmailGuest, EmailHotel, EmailOffer } from "./types"

const { light, dark } = BRAND
const HEX = /^#[0-9a-fA-F]{6}$/

export interface Ctx {
  hotel: EmailHotel
  guest: EmailGuest
  locale: Locale
  copy: Copy
  t: (text: string, values?: Record<string, string>) => string
  theme: Theme
}

export interface Theme {
  dir: "ltr" | "rtl"
  /** Outlook's Word engine ignores `text-align: start`, so alignment is explicit. */
  align: "left" | "right"
  sans: string
  display: string
  primary: string
  onPrimary: string
  accent: string
  onAccent: string
  darkPrimary: string
  darkOnPrimary: string
  darkAccent: string
}

const validColor = (color: string | null | undefined): string | null => (color && HEX.test(color) ? color : null)

/** A brand color too faint on the dark page falls back to the neutral dark theme color, so the button never disappears. */
const forDark = (color: string): string =>
  contrastRatio(color, dark.background) < MIN_UI_CONTRAST ? dark.primary : color

export function buildTheme(hotel: EmailHotel, locale: Locale): Theme {
  const { dir } = htmlAttributes(locale)
  const primary = validColor(hotel.primaryColor) ?? light.primary
  const accent = validColor(hotel.accentColor) ?? primary
  const darkPrimary = forDark(primary)
  return {
    dir,
    align: dir === "rtl" ? "right" : "left",
    ...brandFonts(dir === "rtl"),
    primary,
    onPrimary: readableForeground(primary),
    accent,
    onAccent: readableForeground(accent),
    darkPrimary,
    darkOnPrimary: readableForeground(darkPrimary),
    darkAccent: forDark(accent),
  }
}

export const createCtx = (hotel: EmailHotel, guest: EmailGuest, locale: Locale, copy: Copy): Ctx => {
  const theme = buildTheme(hotel, locale)
  return {
    hotel,
    guest,
    locale,
    copy,
    theme,
    t: (text, values = {}) => fill(text, { hotel: hotel.name, name: guest.name, ...values }, theme.dir === "rtl"),
  }
}

/** Dark mode swaps colors through classes, because inline styles can't answer `prefers-color-scheme`. */
const css = (theme: Theme): string => `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .e-cv { background-color: ${dark.canvas} !important; }
  .e-bg { background-color: ${dark.background} !important; }
  .e-fg { color: ${dark.foreground} !important; }
  .e-mut { color: ${dark.muted} !important; }
  .e-bd { border-color: ${dark.border} !important; }
  .e-sf { background-color: ${dark.surface} !important; }
  .e-pr { background-color: ${theme.darkPrimary} !important; border-color: ${theme.darkPrimary} !important; color: ${theme.darkOnPrimary} !important; }
  .e-ac { background-color: ${theme.darkAccent} !important; border-color: ${theme.darkAccent} !important; }
  .e-logo { background-color: ${light.background} !important; }
}
@media only screen and (max-width: 480px) {
  .e-pad { padding-left: 20px !important; padding-right: 20px !important; }
  .e-btn { width: 100% !important; }
  .e-btn a { display: block !important; text-align: center !important; }
}
`

const text = (theme: Theme): CSSProperties => ({
  margin: 0,
  fontFamily: theme.sans,
  color: light.foreground,
  textAlign: theme.align,
})

const small = (theme: Theme): CSSProperties => ({
  ...text(theme),
  color: light.muted,
  fontSize: 13,
  lineHeight: "20px",
})

export function Layout({ ctx, preview, children }: { ctx: Ctx; preview: string; children: ReactNode }) {
  const { hotel, guest, copy, theme, locale, t } = ctx
  const { lang, dir } = htmlAttributes(locale)
  return (
    <Html lang={lang} dir={dir} style={{ backgroundColor: light.canvas }} className="e-cv">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{css(theme)}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="e-cv" style={{ margin: 0, padding: 0, backgroundColor: light.canvas }}>
        {/* Body copies its background onto an inner cell without the class, so dark mode needs this wrapper. */}
        <Section className="e-cv" style={{ backgroundColor: light.canvas }}>
          <Container style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: "24px 12px" }} dir={dir}>
            <Section
              className="e-bg e-bd"
              style={{
                backgroundColor: light.background,
                border: `1px solid ${light.border}`,
                borderRadius: BRAND.radius,
              }}
            >
              <Section
                className="e-ac"
                style={{
                  height: 6,
                  lineHeight: "6px",
                  fontSize: 0,
                  backgroundColor: theme.accent,
                  borderRadius: `${BRAND.radius - 1}px ${BRAND.radius - 1}px 0 0`,
                }}
              >
                &nbsp;
              </Section>
              <Section className="e-pad" style={{ padding: "28px 32px 0" }}>
                {hotel.logoUrl ? (
                  <Img
                    src={hotel.logoUrl}
                    alt={hotel.name}
                    height={48}
                    className="e-logo"
                    style={{ display: "block", height: 48, width: "auto", maxWidth: 200, borderRadius: 8 }}
                  />
                ) : (
                  <Text className="e-fg" style={{ ...text(theme), fontSize: 18, lineHeight: "26px", fontWeight: 600 }}>
                    {hotel.name}
                  </Text>
                )}
              </Section>
              <Section className="e-pad" style={{ padding: "28px 32px 36px" }}>
                {children}
                <Text className="e-fg" style={{ ...text(theme), margin: "32px 0 0", fontSize: 16, lineHeight: "24px" }}>
                  {copy.common.signoff}
                  <br />
                  {t(copy.common.team)}
                </Text>
              </Section>
            </Section>
            <Section className="e-pad" style={{ padding: "20px 32px 8px" }}>
              <Text className="e-mut" style={small(theme)}>
                {t(copy.common.footerReason)}
              </Text>
              <Text className="e-mut" style={{ ...small(theme), margin: "8px 0 0" }}>
                {hotel.address ? `${hotel.name} · ${hotel.address}` : hotel.name}
              </Text>
              <Text style={{ ...small(theme), margin: "8px 0 0" }}>
                <Link
                  href={guest.unsubscribeUrl}
                  className="e-mut"
                  style={{ color: light.muted, textDecoration: "underline" }}
                >
                  {copy.common.unsubscribe}
                </Link>
              </Text>
              <Text className="e-mut" style={{ ...small(theme), margin: "20px 0 0", fontSize: 12, lineHeight: "18px" }}>
                {copy.common.poweredBy}
              </Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  )
}

/** The display line: serif italic in Latin scripts, upright Naskh in Arabic. */
export function Title({ ctx, children }: { ctx: Ctx; children: ReactNode }) {
  const { theme } = ctx
  const rtl = theme.dir === "rtl"
  return (
    <Heading
      as="h1"
      className="e-fg"
      style={{
        ...text(theme),
        margin: "0 0 20px",
        fontFamily: theme.display,
        fontSize: 32,
        lineHeight: rtl ? "46px" : "38px",
        fontStyle: rtl ? "normal" : "italic",
        fontWeight: rtl ? 700 : 400,
        letterSpacing: rtl ? 0 : "-0.01em",
      }}
    >
      {children}
    </Heading>
  )
}

export function Paragraph({ ctx, children }: { ctx: Ctx; children: ReactNode }) {
  return (
    <Text className="e-fg" style={{ ...text(ctx.theme), margin: "0 0 16px", fontSize: 16, lineHeight: "26px" }}>
      {children}
    </Text>
  )
}

export function Cta({ ctx, href, children }: { ctx: Ctx; href: string; children: ReactNode }) {
  const { theme } = ctx
  return (
    <Section style={{ margin: "28px 0 0" }}>
      <PillButton
        href={href}
        background={theme.primary}
        color={theme.onPrimary}
        fontFamily={theme.sans}
        align={theme.align}
      >
        {children}
      </PillButton>
    </Section>
  )
}

/** Written from the copy, not `Intl`, so the output is the same on every runtime and ICU version. */
const formatDate = (value: string, ctx: Ctx): string | null => {
  const [, year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) ?? []
  const name = ctx.copy.common.months[Number(month) - 1]
  if (!year || !day || !name) return null
  return ctx.t(ctx.copy.common.dateFormat, { year, month: name, day: String(Number(day)) })
}

export function OfferCard({ ctx, offer }: { ctx: Ctx; offer: EmailOffer }) {
  const { theme, copy, t } = ctx
  const until = offer.validUntil ? formatDate(offer.validUntil, ctx) : null
  return (
    <Section
      className="e-sf e-bd"
      style={{
        margin: "8px 0 0",
        padding: 20,
        backgroundColor: light.surface,
        border: `1px solid ${theme.accent}`,
        borderRadius: 16,
      }}
    >
      <Text className="e-fg" style={{ ...text(theme), fontSize: 18, lineHeight: "26px", fontWeight: 600 }}>
        {offer.title}
      </Text>
      {offer.description ? (
        <Text className="e-fg" style={{ ...text(theme), margin: "6px 0 0", fontSize: 15, lineHeight: "22px" }}>
          {offer.description}
        </Text>
      ) : null}
      {offer.code ? (
        <Text className="e-fg" style={{ ...text(theme), margin: "12px 0 0", fontSize: 14, lineHeight: "22px" }}>
          {copy.common.offerCode}:{" "}
          <strong style={{ fontFamily: BRAND.fontMono, letterSpacing: "0.08em" }} dir="ltr">
            {offer.code}
          </strong>
        </Text>
      ) : null}
      {until ? (
        <Text className="e-mut" style={{ ...small(theme), margin: "8px 0 0" }}>
          {t(copy.common.offerValidUntil, { date: until })}
        </Text>
      ) : null}
    </Section>
  )
}
