import { isDemoRecipient } from "@ritorno/common/demo"
import { type Logger, logger } from "@ritorno/logger"
import { createEmailChannel, type EmailExtras } from "./channels/email"
import { createWhatsAppChannel } from "./channels/whatsapp"
import { type RenderedEmail, renderEmail, summarize, toWhatsApp } from "./render"
import type { TemplateData, TemplateName } from "./templates"

export { type AuthEmails, authEmails } from "./auth"
export * from "./hotel-email"
export { renderEmail as renderTemplate } from "./render"
export { type OwnerDigestData, type TemplateData, type TemplateName, templates } from "./templates"
export {
  GUEST_WHATSAPP_TEMPLATES,
  type GuestWhatsAppTemplate,
  guestTemplateFooter,
  guestTemplateParams,
  guestTemplateText,
} from "./whatsapp-guest"

export const CHANNELS = ["email", "whatsapp"] as const
export type Channel = (typeof CHANNELS)[number]

/** The slice of the api env the notifier reads. Every key is optional: a channel is on when its keys are set. */
export interface NotificationEnv {
  NODE_ENV?: string
  /** Real sends need `NODE_ENV=production` and `MESSAGING_LIVE=true`. Anything else only logs. */
  MESSAGING_LIVE?: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  KAPSO_API_KEY?: string
  WHATSAPP_PHONE_NUMBER_ID?: string
  WHATSAPP_NOTIFY_TO?: string
  WHATSAPP_TEMPLATE_NAME?: string
  WHATSAPP_TEMPLATE_LANGUAGE?: string
}

export interface NotifierOptions {
  /** Public url of the app, shown in the email footer. */
  appUrl?: string
  fetch?: typeof fetch
  log?: Logger
}

export interface SendInput<Name extends TemplateName = TemplateName> {
  channel: Channel
  /** Email address or phone number. WhatsApp falls back to the configured one. */
  to?: string
  template: Name
  data: TemplateData<Name>
  /** The unsubscribe or STOP line, appended last. Guest messages always carry one. */
  footer?: string
}

export interface SendResult {
  channel: Channel
  /** False when the channel isn't configured or messaging isn't live. */
  sent: boolean
  id?: string
  error?: string
}

export interface SendEmailInput extends EmailExtras {
  to: string
  email: RenderedEmail
}

export interface SendWhatsAppInput {
  to: string
  /** The Meta template name, see `GUEST_WHATSAPP_TEMPLATES`. */
  template: string
  language: string
  params: Record<string, string>
}

export interface Notifier {
  /** False outside production or without `MESSAGING_LIVE=true`: every send is only logged. */
  live: boolean
  /** The channels that have their keys set. */
  channels: Channel[]
  /** Renders a template for the channel and sends it. An unconfigured channel is skipped, a provider failure throws. */
  send: <Name extends TemplateName>(input: SendInput<Name>) => Promise<SendResult>
  /** An email that is already rendered (the hotel templates): sent with the hotel's name, reply-to and headers. */
  sendEmail: (input: SendEmailInput) => Promise<SendResult>
  /** A free-form WhatsApp reply to a guest who just wrote to us (the STOP confirmation). Log-only outside live messaging. */
  replyWhatsApp: (to: string, text: string) => Promise<SendResult>
  /** An approved named template to a guest. Log-only outside live messaging. */
  sendWhatsApp: (input: SendWhatsAppInput) => Promise<SendResult>
  /** Plain text to every configured channel (or the ones asked for). One channel failing doesn't stop the rest. */
  notify: (text: string, options?: { channels?: Channel[] }) => Promise<SendResult[]>
}

export const isMessagingLive = (env: NotificationEnv): boolean =>
  env.NODE_ENV === "production" && env.MESSAGING_LIVE === "true"

/**
 * One entry point for email and WhatsApp. Channels without keys are simply off.
 * Outside live messaging every channel is on but only logs the channel and template, never the recipient or the text.
 */
export function createNotifier(env: NotificationEnv, options: NotifierOptions = {}): Notifier {
  const live = isMessagingLive(env)
  const log = options.log ?? logger
  const email = !live
    ? null
    : createEmailChannel({
        apiKey: env.RESEND_API_KEY,
        from: env.EMAIL_FROM ?? "onboarding@resend.dev",
        fetch: options.fetch,
      })
  const whatsapp = !live
    ? null
    : createWhatsAppChannel({
        apiKey: env.KAPSO_API_KEY,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        to: env.WHATSAPP_NOTIFY_TO,
        templateName: env.WHATSAPP_TEMPLATE_NAME ?? "app_notification",
        templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US",
        fetch: options.fetch,
      })
  const channels = live ? CHANNELS.filter((channel) => ({ email, whatsapp })[channel]) : [...CHANNELS]

  const on = (channel: Channel) => channels.includes(channel)

  return {
    live,
    channels,
    async send({ channel, to, template, data, footer }) {
      if (!live || (to && isDemoRecipient(to))) {
        log.info("message not sent, log-only provider", { channel, template })
        return { channel, sent: false }
      }
      if (!on(channel)) return { channel, sent: false }
      if (channel === "email") {
        if (!to) throw new Error("Email needs a `to` address.")
        const result = await email?.send(to, await renderEmail(template, data, options.appUrl, footer))
        return { channel, sent: true, id: result?.id }
      }
      const result = (await whatsapp?.send(toWhatsApp(summarize(template, data), footer), { to })) ?? {}
      return { channel, sent: true, id: result.id }
    },
    async sendEmail({ to, email: rendered, ...extras }) {
      if (!live || isDemoRecipient(to)) {
        log.info("message not sent, log-only provider", { channel: "email" })
        return { channel: "email", sent: false }
      }
      if (!email) return { channel: "email", sent: false }
      const result = await email.send(to, rendered, extras)
      return { channel: "email", sent: true, id: result.id }
    },
    async replyWhatsApp(to, text) {
      if (!live || isDemoRecipient(to)) {
        log.info("message not sent, log-only provider", { channel: "whatsapp", template: "stop_confirmation" })
        return { channel: "whatsapp", sent: false }
      }
      if (!whatsapp) return { channel: "whatsapp", sent: false }
      const result = await whatsapp.sendText(to, text)
      return { channel: "whatsapp", sent: true, id: result.id }
    },
    async sendWhatsApp({ to, template, language, params }) {
      if (!live || isDemoRecipient(to)) {
        log.info("message not sent, log-only provider", { channel: "whatsapp", template })
        return { channel: "whatsapp", sent: false }
      }
      if (!whatsapp) return { channel: "whatsapp", sent: false }
      const result = await whatsapp.sendTemplate({ to, name: template, language, params })
      return { channel: "whatsapp", sent: true, id: result.id }
    },
    async notify(text, notifyOptions = {}) {
      const targets = notifyOptions.channels ?? channels
      if (!live) {
        return targets.map((channel) => {
          log.info("message not sent, log-only provider", { channel })
          return { channel, sent: false }
        })
      }
      return Promise.all(
        targets.map(async (channel): Promise<SendResult> => {
          if (channel === "email" || !on(channel)) return { channel, sent: false }
          try {
            const result = (await whatsapp?.send(text)) ?? {}
            return { channel, sent: true, id: result.id }
          } catch (error) {
            return { channel, sent: false, error: error instanceof Error ? error.message : "Send failed." }
          }
        }),
      )
    },
  }
}
