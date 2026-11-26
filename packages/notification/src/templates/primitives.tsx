import { Body, Button, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "@react-email/components"
import { DEFAULT_LOCALE, htmlAttributes, type Locale } from "@ritorno/i18n/config"
import { type CSSProperties, createContext, type ReactNode, useContext } from "react"
import { BRAND, brandFonts } from "../brand"

const { light, dark } = BRAND

/** Shared by every template; the notifier fills `appUrl` from the api's public app url. */
export interface BaseProps {
  appUrl?: string
}

/** Dark mode swaps colors through classes, because inline styles can't answer `prefers-color-scheme`. */
const DARK_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .e-cv { background-color: ${dark.canvas} !important; }
  .e-bg { background-color: ${dark.background} !important; }
  .e-fg { color: ${dark.foreground} !important; }
  .e-mut { color: ${dark.muted} !important; }
  .e-ln { color: ${dark.link} !important; }
  .e-bd { border-color: ${dark.border} !important; }
  .e-sf { background-color: ${dark.surface} !important; }
  .e-pr { background-color: ${dark.primary} !important; border-color: ${dark.primary} !important; color: ${dark.primaryForeground} !important; }
}
@media only screen and (max-width: 480px) {
  .e-card { padding: 28px 20px !important; }
}
`

/** Fonts follow the language: Arabic gets its own stacks and an upright display line. */
const RtlContext = createContext(false)
const useFonts = () => brandFonts(useContext(RtlContext))

const base = (font: string): CSSProperties => ({ margin: 0, fontFamily: font, color: light.foreground })

export function Layout({
  preview,
  appUrl,
  locale = DEFAULT_LOCALE,
  children,
}: {
  preview: string
  appUrl?: string
  locale?: Locale
  children: ReactNode
}) {
  const { lang, dir } = htmlAttributes(locale)
  const rtl = dir === "rtl"
  const { sans } = brandFonts(rtl)
  const host = appUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "")
  const logo = appUrl ? `${appUrl.replace(/\/$/, "")}/brand/email-logo.png` : undefined
  return (
    <Html lang={lang} dir={dir} style={{ backgroundColor: light.canvas }} className="e-cv">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>{DARK_CSS}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="e-cv" style={{ ...base(sans), backgroundColor: light.canvas }}>
        <RtlContext.Provider value={rtl}>
          {/* Body copies its background onto an inner cell without the class, so dark mode needs this wrapper. */}
          <Section className="e-cv" style={{ backgroundColor: light.canvas }}>
            <Container dir={dir} style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "32px 12px" }}>
              <Section style={{ padding: "0 8px 20px" }}>
                <Text
                  className="e-fg"
                  style={{
                    ...base(BRAND.fontDisplay),
                    fontSize: 24,
                    lineHeight: "32px",
                    fontStyle: "italic",
                    textAlign: rtl ? "right" : "left",
                  }}
                >
                  {/* The blue tile carries its own background, so it stays visible when a client forces dark mode. */}
                  {logo ? (
                    <Img
                      src={logo}
                      alt=""
                      width={32}
                      height={32}
                      style={{
                        display: "inline-block",
                        width: 32,
                        height: 32,
                        borderRadius: 7,
                        verticalAlign: "-8px",
                        [rtl ? "marginLeft" : "marginRight"]: 10,
                      }}
                    />
                  ) : null}
                  {BRAND.name}
                </Text>
              </Section>
              {children}
              <Section style={{ padding: "16px 8px 0" }}>
                <Text className="e-mut" style={{ ...base(sans), color: light.muted, fontSize: 12, lineHeight: "18px" }}>
                  Sent by {BRAND.name}
                  {host ? ` · ${host}` : ""}
                </Text>
              </Section>
            </Container>
          </Section>
        </RtlContext.Provider>
      </Body>
    </Html>
  )
}

/** The white card; `surface` tints it for secondary content. */
export function Box({ children, surface = false }: { children: ReactNode; surface?: boolean }) {
  return (
    <Section
      className={surface ? "e-bd e-sf e-card" : "e-bd e-bg e-card"}
      style={{
        border: `1px solid ${light.border}`,
        borderRadius: BRAND.radius,
        backgroundColor: surface ? light.surface : light.background,
        padding: "36px 32px",
        marginBottom: 12,
      }}
    >
      {children}
    </Section>
  )
}

/** Small blue eyebrow above a title; `muted` for row labels. */
export function Label({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { sans } = useFonts()
  return (
    <Text
      className={muted ? "e-mut" : "e-ln"}
      style={{
        ...base(sans),
        color: muted ? light.muted : light.link,
        fontSize: 13,
        lineHeight: "18px",
        fontWeight: 600,
      }}
    >
      {children}
    </Text>
  )
}

/** The display line: serif italic in Latin scripts, upright Naskh in Arabic. */
export function Title({ children }: { children: ReactNode }) {
  const rtl = useContext(RtlContext)
  const { display } = useFonts()
  return (
    <Text
      className="e-fg"
      style={{
        ...base(display),
        margin: "8px 0 0",
        fontSize: 34,
        lineHeight: rtl ? "48px" : "38px",
        fontStyle: rtl ? "normal" : "italic",
        fontWeight: rtl ? 700 : 400,
        letterSpacing: rtl ? 0 : "-0.01em",
      }}
    >
      {children}
    </Text>
  )
}

export function Paragraph({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { sans } = useFonts()
  return (
    <Text
      className={muted ? "e-mut" : "e-fg"}
      style={{
        ...base(sans),
        margin: "16px 0 0",
        color: muted ? light.muted : light.foreground,
        fontSize: muted ? 13 : 16,
        lineHeight: muted ? "20px" : "26px",
      }}
    >
      {children}
    </Text>
  )
}

/**
 * Bulletproof pill: the cell paints the color in Outlook, which drops `border-radius` and link padding, and the
 * react-email button keeps its padding there through its mso spacers. Everywhere else it is a full pill.
 */
export function PillButton({
  href,
  children,
  background,
  color,
  fontFamily,
  align = "left",
  className = "e-pr",
}: {
  href: string
  children: ReactNode
  background: string
  color: string
  fontFamily: string
  align?: "left" | "right"
  className?: string
}) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0} align={align} className="e-btn">
      <tbody>
        <tr>
          <td className={className} style={{ backgroundColor: background, borderRadius: 999 }}>
            <Button
              href={href}
              className={className}
              style={{
                display: "inline-block",
                boxSizing: "border-box",
                backgroundColor: background,
                border: `1px solid ${background}`,
                borderRadius: 999,
                color,
                fontFamily,
                fontSize: 16,
                fontWeight: 600,
                lineHeight: "20px",
                padding: "14px 28px",
                textDecoration: "none",
              }}
            >
              {children}
            </Button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export function CtaButton({ href, children }: { href: string; children: ReactNode }) {
  const rtl = useContext(RtlContext)
  const { sans } = useFonts()
  return (
    <Section style={{ margin: "28px 0 0" }}>
      <PillButton
        href={href}
        background={light.primary}
        color={light.primaryForeground}
        fontFamily={sans}
        align={rtl ? "right" : "left"}
      >
        {children}
      </PillButton>
    </Section>
  )
}

/** A mono, wrapped block for links, codes and other copyable values. */
export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <Section
      className="e-bd e-sf"
      style={{
        border: `1px solid ${light.border}`,
        borderRadius: 10,
        backgroundColor: light.surface,
        padding: "12px 14px",
        margin: "8px 0 0",
      }}
    >
      <Text
        className="e-fg"
        dir="ltr"
        style={{ ...base(BRAND.fontMono), fontSize: 12, lineHeight: "18px", wordBreak: "break-all" }}
      >
        {children}
      </Text>
    </Section>
  )
}

/** The link again as text, for clients that strip buttons. */
export function LinkFallback({ url }: { url: string }) {
  return (
    <Section style={{ margin: "28px 0 0" }}>
      <Label muted>Or paste this link</Label>
      <CodeBlock>
        <Link href={url} className="e-ln" style={{ color: light.link, textDecoration: "none" }}>
          {url}
        </Link>
      </CodeBlock>
    </Section>
  )
}

export function Divider() {
  return <Hr className="e-bd" style={{ border: 0, borderTop: `1px solid ${light.border}`, margin: "28px 0 20px" }} />
}

/** Key and value pairs in rows with 1px rules between them. */
export function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  const { sans } = useFonts()
  return (
    <Section style={{ margin: "20px 0 0" }}>
      {rows.map((row) => (
        <Section key={row.label} className="e-bd" style={{ borderTop: `1px solid ${light.border}`, padding: "12px 0" }}>
          <Label muted>{row.label}</Label>
          <Text className="e-fg" style={{ ...base(sans), margin: "2px 0 0", fontSize: 15, lineHeight: "22px" }}>
            {row.value}
          </Text>
        </Section>
      ))}
    </Section>
  )
}

export const IGNORE_NOTE = "If you didn't ask for this, you can ignore this email."
