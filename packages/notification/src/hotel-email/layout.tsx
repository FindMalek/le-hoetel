import { contrastRatio, MIN_UI_CONTRAST, readableForeground } from "@le-hoetel/common/color"
import { htmlAttributes, type Locale } from "@le-hoetel/i18n/config"
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { CSSProperties, ReactNode } from "react"
import { BRAND } from "../brand"
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
  .e-cta { display: block !important; text-align: center !important; }
}
`

const text = (theme: Theme): CSSProperties => ({
  margin: 0,
  fontFamily: BRAND.fontSans,
  color: light.foreground,
  textAlign: theme.align,
})

export function Layout({ ctx, preview, children }: { ctx: Ctx; preview: string; children: ReactNode }) {
  const { hotel, guest, copy, theme, locale, t } = ctx
  const { lang, dir } = htmlAttributes(locale)
  return (
    <Html lang={lang} dir={dir} style={{ backgroundColor: light.background }} className="e-bg">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{css(theme)}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="e-bg" style={{ margin: 0, padding: 0, backgroundColor: light.background }}>
        <Container style={{ width: "100%", maxWidth: 600, margin: "0 auto" }} dir={dir}>
          <Section
            className="e-ac"
            style={{ height: 6, lineHeight: "6px", fontSize: 0, backgroundColor: theme.accent }}
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
                style={{ display: "block", height: 48, width: "auto", maxWidth: 200, borderRadius: 4 }}
              />
            ) : (
              <Text className="e-fg" style={{ ...text(theme), fontSize: 20, lineHeight: "28px", fontWeight: 700 }}>
                {hotel.name}
              </Text>
            )}
          </Section>
          <Section className="e-pad" style={{ padding: "24px 32px 8px" }}>
            {children}
            <Text className="e-fg" style={{ ...text(theme), margin: "28px 0 0", fontSize: 16, lineHeight: "24px" }}>
              {copy.common.signoff}
              <br />
              {t(copy.common.team)}
            </Text>
          </Section>
          <Section
            className="e-pad e-bd"
            style={{ padding: "20px 32px 32px", borderTop: `1px solid ${light.border}`, marginTop: 24 }}
          >
            <Text className="e-mut" style={{ ...text(theme), color: light.muted, fontSize: 13, lineHeight: "20px" }}>
              {t(copy.common.footerReason)}
            </Text>
            <Text
              className="e-mut"
              style={{ ...text(theme), margin: "8px 0 0", color: light.muted, fontSize: 13, lineHeight: "20px" }}
            >
              {hotel.address ? `${hotel.name} · ${hotel.address}` : hotel.name}
            </Text>
            <Text style={{ ...text(theme), margin: "8px 0 0", fontSize: 13, lineHeight: "20px" }}>
              <Link
                href={guest.unsubscribeUrl}
                className="e-mut"
                style={{ color: light.muted, textDecoration: "underline" }}
              >
                {copy.common.unsubscribe}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function Title({ ctx, children }: { ctx: Ctx; children: ReactNode }) {
  return (
    <Heading
      as="h1"
      className="e-fg"
      style={{ ...text(ctx.theme), margin: "0 0 16px", fontSize: 28, lineHeight: "34px", fontWeight: 700 }}
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
    <Section style={{ margin: "24px 0 0", textAlign: theme.align }}>
      <Button
        href={href}
        className="e-pr e-cta"
        style={{
          display: "inline-block",
          boxSizing: "border-box",
          backgroundColor: theme.primary,
          border: `1px solid ${theme.primary}`,
          borderRadius: 8,
          color: theme.onPrimary,
          fontFamily: BRAND.fontSans,
          fontSize: 16,
          fontWeight: 600,
          lineHeight: "24px",
          padding: "14px 28px",
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
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
        borderRadius: 8,
      }}
    >
      <Text className="e-fg" style={{ ...text(theme), fontSize: 20, lineHeight: "28px", fontWeight: 700 }}>
        {offer.title}
      </Text>
      {offer.description ? (
        <Text className="e-fg" style={{ ...text(theme), margin: "8px 0 0", fontSize: 15, lineHeight: "22px" }}>
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
        <Text
          className="e-mut"
          style={{ ...text(theme), margin: "8px 0 0", color: light.muted, fontSize: 13, lineHeight: "20px" }}
        >
          {t(copy.common.offerValidUntil, { date: until })}
        </Text>
      ) : null}
    </Section>
  )
}
