import { createEmailClient } from "@opencoredev/email-sdk"
import { resend } from "@opencoredev/email-sdk/resend"
import type { RenderedEmail } from "../render"

export interface EmailConfig {
  apiKey?: string
  /** `Name <address@your-domain>`; the domain must be verified in Resend (`pnpm --filter @le-hoetel/notification domain`). */
  from: string
  fetch?: typeof fetch
}

export interface EmailExtras {
  /** Display name in front of the configured address: `Hotel Name <address@your-domain>`. */
  fromName?: string
  replyTo?: string
  headers?: Record<string, string>
}

export interface EmailChannel {
  send: (to: string, email: RenderedEmail, extras?: EmailExtras) => Promise<{ id?: string }>
}

const ADDRESS = /<([^>]+)>\s*$/

/** A hotel name goes into a header, so quotes, angle brackets and line breaks are dropped. */
export function fromWithName(from: string, name?: string): string {
  const clean = name?.replace(/["<>\\\r\n]/g, "").trim()
  if (!clean) return from
  return `"${clean}" <${ADDRESS.exec(from)?.[1] ?? from}>`
}

/** Resend through email-sdk. Returns null without an api key. */
export function createEmailChannel(config: EmailConfig): EmailChannel | null {
  if (!config.apiKey) return null
  const client = createEmailClient({ adapters: [resend({ apiKey: config.apiKey, fetch: config.fetch })] })
  return {
    async send(to, { subject, html, text }, extras = {}) {
      const result = await client.send({
        from: fromWithName(config.from, extras.fromName),
        to,
        subject,
        html,
        text,
        ...(extras.replyTo ? { replyTo: extras.replyTo } : {}),
        ...(extras.headers
          ? { headers: Object.entries(extras.headers).map(([name, value]) => ({ name, value })) }
          : {}),
      })
      return { id: result.id }
    },
  }
}
