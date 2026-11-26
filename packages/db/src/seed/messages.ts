import type { MessageChannel } from "@ritorno/common/consent"
import { HOLIDAYS, type HolidayChannel, type HolidayKey, holidaysOn } from "@ritorno/common/holidays"
import type { HotelLanguage } from "@ritorno/common/hotel"
import type { MessagePreview } from "@ritorno/common/message"
import { whatsappPriceMillimes } from "@ritorno/common/pricing"
import {
  type EmailProps,
  guestTemplateParams,
  guestTemplateText,
  type HotelEmailKey,
  renderEmail,
} from "@ritorno/notification"
import type {
  automationSends,
  balanceLedger,
  campaignRecipients,
  campaigns,
  hotelBalance,
  hotelHolidays,
  messages,
} from "../schema"
import { CAMPAIGNS } from "./campaigns"
import { DEMO_HOTELS, demoHotelId, HISTORY_DAYS, type HotelScenario } from "./hotels"
import type { OfferScenario } from "./offers"
import { DAY, day, dice, earlier } from "./random"
import type { SurveyScenario } from "./surveys"

export interface MessageScenario {
  messages: (typeof messages.$inferInsert)[]
  campaigns: (typeof campaigns.$inferInsert)[]
  campaignRecipients: (typeof campaignRecipients.$inferInsert)[]
  hotelHolidays: (typeof hotelHolidays.$inferInsert)[]
  automationSends: (typeof automationSends.$inferInsert)[]
  hotelBalance: (typeof hotelBalance.$inferInsert)[]
  balanceLedger: (typeof balanceLedger.$inferInsert)[]
}

export interface PreviewLinks {
  webUrl: string
  apiUrl: string
  /** Hotel id to the storage key of its logo, when one was uploaded. */
  logoKeys?: Map<string, string>
}

const HOLIDAY_CHOICES: Partial<Record<HolidayKey, HolidayChannel>> = {
  ramadan_start: "both",
  eid_al_fitr: "whatsapp",
  eid_al_adha: "both",
  mawlid: "email",
  republic_day: "email",
  new_year: "both",
}

/** Younger than this, a demo message is one the log-only providers kept as a preview. */
const LOG_ONLY_DAYS = 7
const NAME = "ZZGUESTZZ"

type Guest = HotelScenario["guests"][number]

interface Intent {
  guest: Guest
  channel: MessageChannel
  template: HotelEmailKey
  at: Date
  props: EmailProps[HotelEmailKey]
  /** Tells apart two texts of the same template, for the preview cache. */
  variant: string
  claim?: { kind: string; period: string }
  campaignId?: string
}

const channelsOf = (choice: HolidayChannel | MessageChannel): MessageChannel[] =>
  choice === "both" ? ["email", "whatsapp"] : [choice]

/**
 * What the dashboard's message log, campaigns, holidays and prepaid balance show: welcome, survey, birthday, holiday
 * and campaign messages in every status, the claims that keep the jobs from sending them again, and the ledger.
 * Nothing here ever reached a provider.
 */
export async function buildMessageScenario(
  now: Date,
  hotels: HotelScenario,
  offerRows: OfferScenario,
  surveys: SurveyScenario,
  links: PreviewLinks,
  seed = 20261127,
): Promise<MessageScenario> {
  const { rand, pick, chance, uuid } = dice(seed)
  const out: MessageScenario = {
    messages: [],
    campaigns: [],
    campaignRecipients: [],
    hotelHolidays: [],
    automationSends: [],
    hotelBalance: [],
    balanceLedger: [],
  }

  const events = new Map<string, HotelScenario["consentEvents"]>()
  for (const event of hotels.consentEvents) {
    const key = `${event.guestId}:${event.channel}`
    events.set(key, [...(events.get(key) ?? []), event])
  }
  const consented = (guest: Guest, channel: MessageChannel, at: Date) =>
    events
      .get(`${guest.id}:${channel}`)
      ?.filter((e) => e.at! <= at)
      .at(-1)?.granted === true
  const guestsById = new Map(hotels.guests.map((g) => [g.id!, g]))
  const answered = new Set(surveys.surveyResponses.map((r) => r.inviteId))
  const renders = new Map<string, Promise<{ subject: string; html: string }>>()

  for (const [slug, hotel] of Object.entries(DEMO_HOTELS)) {
    const hotelId = demoHotelId(slug as keyof typeof DEMO_HOTELS)
    const people = hotels.guests.filter((g) => g.hotelId === hotelId)
    const ownOffers = offerRows.offers.filter((o) => o.hotelId === hotelId)
    const offerOf = (code: string) => ownOffers.find((o) => o.promoCode === code)!
    const perk = (code: string) => {
      const offer = offerOf(code)
      return {
        offer: {
          title: offer.title,
          description: offer.text,
          validUntil: offer.validUntil ? day(offer.validUntil) : null,
          code: "DEMO-CODE",
        },
        ctaUrl: `${links.webUrl}/o/preview`,
      }
    }
    const intents: Intent[] = []
    const add = (intent: Omit<Intent, "channel">, wanted: MessageChannel[] = ["email", "whatsapp"]) => {
      if (intent.at >= now) return
      for (const channel of wanted)
        if (consented(intent.guest, channel, intent.at)) intents.push({ ...intent, channel })
    }

    for (const guest of people) {
      if (guest.source !== "csv")
        add({
          guest,
          template: "welcome",
          variant: "",
          at: earlier(now, new Date(+guest.createdAt! + 60_000)),
          props: perk("WELCOME"),
          claim: { kind: "welcome", period: "" },
        })
      if (!guest.birthday) continue
      for (const year of [now.getUTCFullYear() - 1, now.getUTCFullYear()]) {
        const at = new Date(`${year}-${guest.birthday.slice(5)}T08:05:00Z`)
        if (at < guest.createdAt! || +now - +at > HISTORY_DAYS * DAY) continue
        add({
          guest,
          template: "birthday",
          variant: "",
          at,
          props: perk("BIRTHDAY"),
          claim: { kind: "birthday", period: String(year) },
        })
      }
    }

    for (const invite of surveys.surveyInvites.filter((i) => i.hotelId === hotelId)) {
      const guest = guestsById.get(invite.guestId)!
      add({
        guest,
        template: "survey",
        variant: "",
        at: invite.sentAt!,
        props: { ctaUrl: `${links.webUrl}/s/preview` },
        claim: { kind: "survey", period: "" },
      })
      if (!answered.has(invite.id!) && chance(0.15))
        add({
          guest,
          template: "reminder",
          variant: "",
          at: new Date(+invite.sentAt! + 3 * DAY),
          props: perk("WELCOME"),
        })
    }

    for (const [key, channel] of Object.entries(HOLIDAY_CHOICES) as [HolidayKey, HolidayChannel][]) {
      out.hotelHolidays.push({
        hotelId,
        holidayKey: key,
        enabled: true,
        channel,
        updatedAt: new Date(+now - 90 * DAY),
      })
    }
    for (let back = HISTORY_DAYS; back >= 0; back--) {
      const at = new Date(+now - back * DAY)
      at.setUTCHours(8, 15, 0, 0)
      const key = holidaysOn(day(at)).find((k) => HOLIDAY_CHOICES[k])
      if (!key) continue
      for (const guest of people) {
        if (guest.createdAt! > at) continue
        const greeting = HOLIDAYS[key].text[guest.language]
        add(
          {
            guest,
            template: "message",
            variant: key,
            at,
            props: { subject: `${greeting.name} · {hotel}`, title: `${greeting.name}, {name}`, body: greeting.body },
            claim: { kind: "holiday", period: day(at) },
          },
          channelsOf(HOLIDAY_CHOICES[key]!),
        )
      }
    }

    for (const def of CAMPAIGNS) {
      const id = uuid()
      // Written the way a manager types it, with the hotel's name in the text.
      const content = JSON.parse(JSON.stringify(def.content).replaceAll("{hotel}", hotel.name)) as typeof def.content
      const scheduledAt = def.daysAgo === null ? null : new Date(+now - def.daysAgo * DAY)
      scheduledAt?.setUTCHours(9, 0, 0, 0)
      const createdAt = new Date(+now - ((def.daysAgo ?? 0) > 0 ? def.daysAgo! + 2 : 3) * DAY)
      out.campaigns.push({
        id,
        hotelId,
        name: def.name,
        channel: def.channel,
        content,
        segment: def.segment,
        offerId: def.offer ? offerOf(def.offer).id : null,
        status: def.status,
        scheduledAt,
        completedAt: def.status === "sent" ? new Date(+scheduledAt! + 25 * 60_000) : null,
        createdAt,
        updatedAt: def.status === "sent" ? scheduledAt! : createdAt,
      })
      if (def.status !== "sent") continue
      const { languages, countries } = def.segment
      for (const guest of people) {
        if (guest.createdAt! > scheduledAt!) continue
        if (languages.length && !languages.includes(guest.language)) continue
        if (countries.length && !countries.includes(guest.country ?? "")) continue
        const text = content[guest.language]!
        add(
          {
            guest,
            template: "message",
            variant: id,
            at: new Date(+scheduledAt! + Math.floor(rand() * 20 * 60_000)),
            props: { subject: text.subject, title: text.subject, body: text.body, ...(def.offer && perk(def.offer)) },
            campaignId: id,
          },
          channelsOf(def.channel!),
        )
      }
    }

    intents.sort((a, b) => a.at.getTime() - b.at.getTime())
    const claimed = new Set<string>()
    const low = hotel.balanceMillimes < 5000
    const usage: (typeof balanceLedger.$inferInsert)[] = []
    for (const [index, intent] of intents.entries()) {
      const { guest, channel, template, at } = intent
      if (intent.claim) {
        const claimKey = `${guest.id}:${intent.claim.kind}:${intent.claim.period}:${channel}`
        if (claimed.has(claimKey)) continue
        claimed.add(claimKey)
        out.automationSends.push({ hotelId, guestId: guest.id!, ...intent.claim, channel, createdAt: at })
      }
      const age = (+now - +at) / DAY
      const recent = age < LOG_ONLY_DAYS
      const roll = rand()
      const status =
        index >= intents.length - 3
          ? "queued"
          : intent.campaignId && roll > 0.985
            ? "skipped_no_consent"
            : low && channel === "whatsapp" && recent && roll < 0.3
              ? "skipped_no_balance"
              : roll < 0.045
                ? "failed"
                : recent || roll < 0.14
                  ? "sent"
                  : "delivered"
      const logOnly = status === "sent" && recent
      const reached = status === "sent" || status === "delivered"
      const id = uuid()
      out.messages.push({
        id,
        hotelId,
        guestId: guest.id!,
        channel,
        templateKey: template,
        language: guest.language,
        status,
        providerId: logOnly ? "log-only" : reached || status === "failed" ? `demo-${id}` : null,
        errorCode:
          status === "failed" ? (channel === "email" ? "bounced" : pick(["131026", "131047", "send_failed"])) : null,
        preview: logOnly ? await preview(intent, hotelId) : null,
        createdAt: at,
        sentAt: reached ? at : null,
        deliveredAt: status === "delivered" ? new Date(+at + 40_000) : null,
        failedAt: status === "failed" ? new Date(+at + 15_000) : null,
      })
      if (intent.campaignId)
        out.campaignRecipients.push({
          campaignId: intent.campaignId,
          hotelId,
          guestId: guest.id!,
          channel,
          messageId: id,
          createdAt: at,
        })
      if (channel !== "whatsapp" || status.startsWith("skipped")) continue
      const price = whatsappPriceMillimes(template)
      usage.push({ hotelId, kind: "usage", amountMillimes: -price, messageId: id, createdAt: at })
      if (status === "failed")
        usage.push({
          hotelId,
          kind: "refund",
          amountMillimes: price,
          messageId: id,
          createdAt: new Date(+at + 20_000),
        })
    }

    // Four bank transfers that, minus what was used, leave exactly the balance the hotel should show.
    const total = hotel.balanceMillimes - usage.reduce((sum, row) => sum + row.amountMillimes, 0)
    const quarter = Math.floor(total / 4)
    // A hotel with credit to spare topped up this week, so the ledger shows one among the usage.
    const topUps = [190, 130, 75, low ? 20 : 0.1].map((daysAgo, i) => ({
      hotelId,
      kind: "top_up" as const,
      amountMillimes: i === 0 ? total - 3 * quarter : quarter,
      note: `Bank transfer ${i + 1}`,
      createdBy: "demo-super-admin",
      createdAt: new Date(+now - daysAgo * DAY),
    }))
    out.hotelBalance.push({ hotelId, balanceMillimes: hotel.balanceMillimes, updatedAt: now })
    out.balanceLedger.push(...topUps, ...usage)
  }
  return out

  /** What the dispatcher keeps for a message it did not really send. Rendered once per text, the name filled in after. */
  async function preview(intent: Intent, hotelId: string): Promise<MessagePreview> {
    const { guest, channel, template, props } = intent
    const language: HotelLanguage = guest.language
    const settings = hotels.hotelSettings.find((h) => h.organizationId === hotelId)!
    const hotelName = settings.displayName
    if (channel === "whatsapp") {
      const body = "body" in props ? props.body.replaceAll("{hotel}", hotelName) : undefined
      const params = guestTemplateParams(template, {
        guestName: guest.name,
        hotelName,
        props: body ? { ...props, body } : props,
      })
      return { text: guestTemplateText(template, language, params) }
    }
    const cacheKey = `${hotelId}:${template}:${language}:${intent.variant}`
    let rendered = renders.get(cacheKey)
    if (!rendered) {
      const logoKey = links.logoKeys?.get(hotelId)
      rendered = renderEmail(template, {
        hotel: {
          name: hotelName,
          logoUrl: logoKey ? `${links.apiUrl}/files/${logoKey}` : null,
          primaryColor: settings.primaryColor,
          accentColor: settings.accentColor,
          address: settings.address,
        },
        guest: { name: NAME, unsubscribeUrl: `${links.webUrl}/u/preview` },
        locale: language,
        props,
      })
      renders.set(cacheKey, rendered)
    }
    const { subject, html } = await rendered
    return { subject: subject.replaceAll(NAME, guest.name), html: html.replaceAll(NAME, guest.name) }
  }
}
