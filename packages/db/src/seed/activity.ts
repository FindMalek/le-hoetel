import { DEMO_EMAIL_DOMAIN } from "@ritorno/common/demo"
import type { auditLog, hotelSettings, inboxItem, invitation, organization, user } from "../schema"
import type { HotelScenario } from "./hotels"
import type { MessageScenario } from "./messages"
import type { OfferScenario } from "./offers"
import { DAY, dice, earlier, HOUR, momentAgo } from "./random"
import type { SurveyScenario } from "./surveys"

export interface ActivityScenario {
  users: (typeof user.$inferInsert)[]
  organizations: (typeof organization.$inferInsert)[]
  hotelSettings: (typeof hotelSettings.$inferInsert)[]
  invitations: (typeof invitation.$inferInsert)[]
  inboxItems: (typeof inboxItem.$inferInsert)[]
  auditLog: (typeof auditLog.$inferInsert)[]
}

const ADMIN = "demo-super-admin"
/** Documentation ranges (RFC 5737), never a real visitor. */
const IPS = ["192.0.2.14", "192.0.2.87", "198.51.100.23", "198.51.100.140", "203.0.113.9", "203.0.113.201"]

const ALERTS = {
  en: { score: "Low score to follow up", campaign: "Campaign sent", balance: "WhatsApp credit is low" },
  fr: { score: "Note basse à traiter", campaign: "Campagne envoyée", balance: "Crédit WhatsApp faible" },
  ar: { score: "تقييم منخفض يحتاج متابعة", campaign: "تم إرسال الحملة", balance: "رصيد واتساب منخفض" },
}

/**
 * What happened around the demo: notifications for the team, the audit log, and two hotels only the platform admin
 * sees (one waiting for its owner, one suspended), so the admin screens have every health to show.
 */
export function buildActivityScenario(
  now: Date,
  hotels: HotelScenario,
  offerRows: OfferScenario,
  surveys: SurveyScenario,
  sent: MessageScenario,
  opts: { ownerId?: string } = {},
  seed = 20261128,
): ActivityScenario {
  const { rand, int, pick, uuid } = dice(seed)
  const ago = (days: number) => momentAgo(now, days, rand)
  const out: ActivityScenario = {
    users: [
      {
        id: "demo-former-staff",
        name: "Walid Ncibi",
        email: `former.reception@${DEMO_EMAIL_DOMAIN}`,
        emailVerified: true,
        banned: true,
        banReason: "Left the hotel",
        createdAt: ago(150),
        updatedAt: ago(40),
      },
      {
        id: "demo-unverified",
        name: "Ines Rekik",
        email: `ines.rekik@${DEMO_EMAIL_DOMAIN}`,
        emailVerified: false,
        createdAt: ago(3),
        updatedAt: ago(3),
      },
    ],
    organizations: [],
    hotelSettings: [],
    invitations: [],
    inboxItems: [],
    auditLog: [],
  }
  const log = (
    at: Date,
    actorId: string,
    action: string,
    targetId: string | null,
    metadata: Record<string, unknown> | null,
  ) => {
    out.auditLog.push({
      id: uuid(),
      actorId,
      action,
      targetId,
      metadata,
      ip: pick(IPS),
      createdAt: earlier(now, at),
    })
  }

  const extras = [
    { slug: "dar-yasmine", name: "Dar Yasmine", status: "pilot" as const, color: "#7b4b94", days: 4 },
    {
      slug: "hotel-les-orangers",
      name: "Hotel Les Orangers",
      status: "suspended" as const,
      color: "#c4621a",
      days: 95,
    },
  ]
  for (const extra of extras) {
    const id = `demo-hotel-${extra.slug}`
    const createdAt = ago(extra.days)
    out.organizations.push({ id, name: extra.name, slug: extra.slug, createdAt })
    out.hotelSettings.push({
      organizationId: id,
      displayName: extra.name,
      primaryColor: extra.color,
      accentColor: "#a86a0a",
      defaultLanguage: "fr",
      address: `${extra.name}, Sousse, Tunisia`,
      status: extra.status,
      pilotEndsAt: extra.status === "pilot" ? new Date(+now + 56 * DAY) : null,
      createdAt,
    })
    log(createdAt, ADMIN, "hotel.create", id, null)
    out.invitations.push({
      id: `demo-invite-${extra.slug}`,
      organizationId: id,
      email: `owner.${extra.slug}@${DEMO_EMAIL_DOMAIN}`,
      role: "owner",
      status: extra.status === "pilot" ? "pending" : "canceled",
      expiresAt: new Date(+createdAt + 7 * DAY),
      createdAt,
      inviterId: ADMIN,
    })
    if (extra.status === "suspended") log(ago(20), ADMIN, "hotel.admin-update", id, { hotelId: id, fields: ["status"] })
  }

  const admins = [ADMIN, ...(opts.ownerId ? [opts.ownerId] : [])]
  for (const settings of hotels.hotelSettings) {
    const hotelId = settings.organizationId
    const copy = ALERTS[settings.defaultLanguage!]
    const team = hotels.members.filter((m) => m.organizationId === hotelId)
    const ownerId = team.find((m) => m.role === "owner")!.userId
    const managers = team.filter((m) => m.role !== "staff").map((m) => m.userId)
    const people = hotels.guests.filter((g) => g.hotelId === hotelId)
    const meta = (extra: Record<string, unknown> = {}) => ({ hotelId, ...extra })

    log(settings.createdAt!, ADMIN, "hotel.create", hotelId, null)
    log(ago(190), ownerId, "hotel.logo-set", hotelId, meta())
    log(ago(188), ownerId, "hotel.update", hotelId, meta({ fields: ["primaryColor", "accentColor"] }))
    log(ago(180), ownerId, "hotel.update", hotelId, meta({ fields: ["googleReviewUrl", "replyToEmail"] }))
    log(ago(179), ownerId, "email.send-test", null, meta())
    log(ago(9), pick(managers), "email.send-test", null, meta())
    log(ago(90), ownerId, "holiday.update", "mawlid", meta({ enabled: true, channel: "email" }))
    log(ago(70), ownerId, "profile.update", ownerId, meta())
    log(ago(12), ADMIN, "admin.impersonate", ownerId, meta())
    log(new Date(+now - 12 * DAY + HOUR), ADMIN, "admin.impersonate-stop", null, meta())
    log(ago(33), ADMIN, "hotel.admin-update", hotelId, meta({ fields: ["plan"] }))
    log(ago(6), ownerId, "guest.export-all", null, meta({ count: people.length }))
    log(ago(150), ownerId, "guest.import", null, meta({ count: people.filter((g) => g.source === "csv").length }))
    for (let i = 0; i < 6; i++) log(ago(int(60)), pick(managers), "guest.export", pick(people).id!, meta())
    for (const event of hotels.consentEvents.filter((e) => e.hotelId === hotelId && e.staffUserId && !e.granted))
      log(event.at!, event.staffUserId!, "guest.consent", event.guestId, meta({ channel: event.channel }))
    for (const top of sent.balanceLedger.filter((l) => l.hotelId === hotelId && l.kind === "top_up"))
      log(top.createdAt!, ADMIN, "hotel.balance.top_up", hotelId, meta({ amountMillimes: top.amountMillimes }))
    for (const offer of offerRows.offers.filter((o) => o.hotelId === hotelId))
      log(offer.createdAt!, pick(managers), "offer.create", offer.id!, meta())
    for (const redemption of offerRows.offerRedemptions.filter((r) => r.hotelId === hotelId).slice(-40))
      log(redemption.redeemedAt!, redemption.redeemedBy!, "offer.redeem", null, meta({ offerId: redemption.offerId }))
    for (const campaign of sent.campaigns.filter((c) => c.hotelId === hotelId)) {
      log(campaign.createdAt!, ownerId, "campaign.create", campaign.id!, meta())
      if (campaign.status !== "draft")
        log(new Date(+campaign.createdAt! + HOUR), ownerId, "campaign.schedule", campaign.id!, meta())
      if (campaign.status === "cancelled")
        log(new Date(+campaign.createdAt! + 5 * HOUR), ownerId, "campaign.cancel", campaign.id!, meta())
    }

    const notes: { title: string; body: string; href: string; at: Date }[] = []
    const responses = new Map(surveys.surveyResponses.map((r) => [r.id!, r]))
    for (const feedback of surveys.feedbackCases.filter((c) => c.hotelId === hotelId)) {
      if (feedback.status !== "new")
        log(
          feedback.updatedAt!,
          feedback.handledBy!,
          "feedback-case.update",
          feedback.id!,
          meta({ status: feedback.status }),
        )
      if (+now - +feedback.createdAt! > 30 * DAY) continue
      const response = responses.get(feedback.responseId)!
      notes.push({
        title: copy.score,
        body: `${response.nps}/10 · ${response.comment}`,
        href: `/feedback/${feedback.id}`,
        at: feedback.createdAt!,
      })
    }
    for (const campaign of sent.campaigns.filter((c) => c.hotelId === hotelId && c.status === "sent"))
      notes.push({
        title: copy.campaign,
        body: campaign.name,
        href: `/campaigns/${campaign.id}`,
        at: campaign.completedAt!,
      })
    const balance = sent.hotelBalance.find((b) => b.hotelId === hotelId)!.balanceMillimes!
    if (balance < 5000)
      notes.push({ title: copy.balance, body: `${(balance / 1000).toFixed(3)} TND`, href: "/usage", at: ago(1) })

    for (const userId of [...managers, ...admins]) {
      for (const note of admins.includes(userId) ? notes.slice(-3) : notes) {
        const unread = +now - +note.at < 4 * DAY
        out.inboxItems.push({
          id: uuid(),
          userId,
          title: note.title,
          body: note.body,
          href: note.href,
          createdAt: note.at,
          readAt: unread ? null : earlier(now, new Date(+note.at + (1 + int(20)) * HOUR)),
        })
      }
    }
  }
  return out
}
