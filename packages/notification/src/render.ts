import { render } from "@react-email/render"
import { createElement } from "react"
import { getTemplate, type TemplateData, type TemplateName } from "./templates"
import type { Summary } from "./templates/define"

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export function summarize<Name extends TemplateName>(name: Name, data: TemplateData<Name>): Summary {
  return getTemplate(name).summary(data)
}

/** Html and a plain-text twin, rendered from the same react tree. */
export async function renderEmail<Name extends TemplateName>(
  name: Name,
  data: TemplateData<Name>,
  appUrl?: string,
  footer?: string,
): Promise<RenderedEmail> {
  const template = getTemplate(name)
  const element = createElement(template.Email, { ...data, appUrl } as Record<string, unknown>)
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  const email = { subject: template.subject(data), html, text }
  return footer ? withFooter(email, footer) : email
}

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

/** The unsubscribe line goes last in both bodies; in html its url becomes a link. */
function withFooter(email: RenderedEmail, footer: string): RenderedEmail {
  const line = escapeHtml(footer).replace(/https?:\/\/\S+/, (url) => `<a href="${url}">${url}</a>`)
  const block = `<p dir="auto" style="font-size:12px;text-align:center;margin:16px 0">${line}</p>`
  const html = email.html.includes("</body>") ? email.html.replace("</body>", `${block}</body>`) : email.html + block
  return { ...email, html, text: `${email.text}\n\n${footer}` }
}

const MARKDOWN_SPECIALS = /([_*`[])/g

/** Telegram's legacy Markdown: bold title, plain lines, one link. */
export function toTelegram({ title, lines, link }: Summary): string {
  const esc = (text: string) => text.replace(MARKDOWN_SPECIALS, "\\$1")
  return [`*${esc(title)}*`, ...lines.map(esc), link ? `[${esc(link.label)}](${link.url.replaceAll(")", "%29")})` : ""]
    .filter(Boolean)
    .join("\n")
}

const WHATSAPP_MAX = 900

/** WhatsApp template variables can't hold line breaks, so this is one short line. */
export function toWhatsApp({ title, lines, link }: Summary, footer?: string): string {
  const text = [/[.!?]$/.test(title) ? title : `${title}.`, ...lines, link?.url]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
  const tail = footer ? ` ${footer}` : ""
  return (text.length + tail.length > WHATSAPP_MAX ? `${text.slice(0, WHATSAPP_MAX - tail.length - 1)}…` : text) + tail
}
