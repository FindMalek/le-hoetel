import { createHmac } from "node:crypto"
import { captureUrl } from "@ritorno/common/qr"
import { CAPTURE_SOURCES, type CaptureSource } from "@ritorno/common/schemas"
import { readScanCode, scanNotice, scanWelcome, WHATSAPP_SCAN_RETENTION_DAYS } from "@ritorno/common/whatsapp-scan"
import { type Db, guests, hotelSettings, member, organization, whatsappScans } from "@ritorno/db"
import { and, desc, eq, gte, inArray, lt, lte, ne } from "drizzle-orm"
import type { Context } from "../context"
import { notifyInbox } from "./inbox"
import type { KapsoPayload } from "./messages"
import { welcomeOffer } from "./offers"
import { RATE_LIMITS } from "./rate-limit"

type Ctx = Pick<Context, "db" | "config" | "now" | "notification" | "rateLimiter">

const DAY_MS = 24 * 60 * 60_000

const cutoff = (now: Date) => new Date(now.getTime() - WHATSAPP_SCAN_RETENTION_DAYS * DAY_MS)

/** Kapso retries a delivery within minutes: anything older than this is not a guest waiting for an answer. */
const MAX_AGE_MS = 60 * 60_000

/**
 * A redelivery must not bring back a scan that a STOP, Remove or guest delete took away. Each message id counts
 * once, and an old message is dropped even after the limiter forgot it.
 */
async function isRedelivery(context: Ctx, message: NonNullable<KapsoPayload["message"]>): Promise<boolean> {
  const sentAt = Number(message.timestamp) * 1000
  if (sentAt && context.now().getTime() - sentAt > MAX_AGE_MS) return true
  if (!message.id) return false
  const id = createHmac("sha256", context.config.tokenSecret).update(message.id).digest("base64url")
  return !(await context.rateLimiter.hit(`whatsapp.scan:message:${id}`, RATE_LIMITS.scanMessage)).ok
}

/** Never the number itself in a key: it can live in a shared Redis. */
async function underLimits(context: Ctx, hotelId: string, phoneE164: string): Promise<boolean> {
  const who = createHmac("sha256", context.config.tokenSecret).update(phoneE164).digest("base64url")
  const phone = await context.rateLimiter.hit(`whatsapp.scan:phone:${who}`, RATE_LIMITS.scanPhone)
  if (!phone.ok) return false
  return (await context.rateLimiter.hit(`whatsapp.scan:hotel:${hotelId}`, RATE_LIMITS.scanHotel)).ok
}

/** Records the scan and says whether this one gets the welcome: at most one per hotel and number in 24 hours. */
async function claimReply(db: Db, scan: typeof whatsappScans.$inferInsert): Promise<boolean> {
  const { source, location, language, lastScanAt, repliedAt } = scan
  const [claimed] = await db
    .insert(whatsappScans)
    .values(scan)
    .onConflictDoUpdate({
      target: [whatsappScans.hotelId, whatsappScans.phoneE164],
      set: { source, location, language, lastScanAt, repliedAt },
      setWhere: lte(whatsappScans.repliedAt, new Date(repliedAt.getTime() - DAY_MS)),
    })
    .returning({ id: whatsappScans.id })
  if (claimed) return true
  await db
    .update(whatsappScans)
    .set({ source, location, language, lastScanAt })
    .where(and(eq(whatsappScans.hotelId, scan.hotelId), eq(whatsappScans.phoneE164, scan.phoneE164)))
  return false
}

async function notifyStaff(db: Db, hotelId: string, notice: { title: string; body: string }): Promise<void> {
  const members = await db.select({ userId: member.userId }).from(member).where(eq(member.organizationId, hotelId))
  for (const { userId } of members) await notifyInbox(db, userId, { ...notice, href: "/whatsapp" })
}

/**
 * An inbound WhatsApp message carrying a QR code's reference. Answers once with the hotel's scripted welcome (free
 * form, inside the 24 hour window the guest just opened) and tells the staff. Writing to us is not a consent: no
 * guest and no consent is created or changed. A message without a code this server signed, or for a suspended
 * hotel, is ignored. Returns whether a reply was claimed.
 */
export async function handleWhatsAppScan(context: Ctx, payload: KapsoPayload): Promise<boolean> {
  const { from, type, text } = payload.message ?? {}
  const digits = from?.replace(/\D/g, "")
  if (!digits || digits.length > 15 || type !== "text") return false
  const spot = readScanCode(context.config.tokenSecret, text?.body ?? "")
  if (!spot) return false
  const [hotel] = await context.db
    .select({ id: organization.id, name: hotelSettings.displayName, language: hotelSettings.defaultLanguage })
    .from(organization)
    .innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))
    .where(and(eq(organization.slug, spot.slug), ne(hotelSettings.status, "suspended")))
  const phoneE164 = `+${digits}`
  if (!hotel || (await isRedelivery(context, payload.message!))) return false
  if (!(await underLimits(context, hotel.id, phoneE164))) return false

  const now = context.now()
  const claimed = await claimReply(context.db, {
    hotelId: hotel.id,
    phoneE164,
    source: CAPTURE_SOURCES[spot.source],
    location: spot.location,
    language: spot.language,
    lastScanAt: now,
    repliedAt: now,
  })
  if (!claimed) return false

  const [guest] = await context.db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.hotelId, hotel.id), eq(guests.phoneE164, phoneE164)))
  const page = new URL(captureUrl(context.config.webUrl, spot.slug, spot.source, spot.location))
  page.searchParams.set("lang", spot.language)
  const reply = scanWelcome({
    language: spot.language,
    hotelName: hotel.name,
    offer: await welcomeOffer(context.db, hotel.id, now),
    registerUrl: guest ? null : page.toString(),
  })
  // Not retried: a lost answer may still have sent it. Staff see the scan either way.
  await context.notification.replyWhatsApp(phoneE164, reply, "scan_welcome").catch((error: unknown) => {
    // Never the error itself: a provider's text can carry the number.
    console.error("[whatsapp-scan] welcome not sent", {
      hotelId: hotel.id,
      status: (error as { httpStatus?: number } | null)?.httpStatus,
    })
  })
  await notifyStaff(context.db, hotel.id, scanNotice(hotel.language, hotel.name, spot.source, spot.location))
  return true
}

const SPOT_OF_SOURCE = Object.fromEntries(
  Object.entries(CAPTURE_SOURCES).map(([spot, source]) => [source, spot]),
) as Record<string, CaptureSource>

/** The hotel's scans still kept, newest first, with the guest when that number signed up. */
export async function listScans(db: Db, hotelId: string, now: Date) {
  const rows = await db
    .select({
      id: whatsappScans.id,
      phoneE164: whatsappScans.phoneE164,
      source: whatsappScans.source,
      location: whatsappScans.location,
      language: whatsappScans.language,
      lastScanAt: whatsappScans.lastScanAt,
      guestId: guests.id,
      guestName: guests.name,
    })
    .from(whatsappScans)
    .leftJoin(guests, and(eq(guests.hotelId, whatsappScans.hotelId), eq(guests.phoneE164, whatsappScans.phoneE164)))
    .where(and(eq(whatsappScans.hotelId, hotelId), gte(whatsappScans.lastScanAt, cutoff(now))))
    .orderBy(desc(whatsappScans.lastScanAt), whatsappScans.id)
    .limit(100)
  return rows.map(({ source, ...row }) => ({ ...row, spot: SPOT_OF_SOURCE[source] ?? "desk" }))
}

const ofGuest = (db: Pick<Db, "select">, hotelId: string, guestId: string) =>
  inArray(
    whatsappScans.phoneE164,
    db
      .select({ phone: guests.phoneE164 })
      .from(guests)
      .where(and(eq(guests.hotelId, hotelId), eq(guests.id, guestId))),
  )

/** For the guest data exports. `guestId` null is every scan of the hotel, signed up or not. */
export function scansForExport(db: Db, hotelId: string, guestId: string | null) {
  return db
    .select({
      phoneE164: whatsappScans.phoneE164,
      source: whatsappScans.source,
      location: whatsappScans.location,
      language: whatsappScans.language,
      lastScanAt: whatsappScans.lastScanAt,
      repliedAt: whatsappScans.repliedAt,
    })
    .from(whatsappScans)
    .where(and(eq(whatsappScans.hotelId, hotelId), guestId ? ofGuest(db, hotelId, guestId) : undefined))
    .orderBy(desc(whatsappScans.lastScanAt))
}

/** Call inside a guest delete's transaction, before the guest row goes. `guestId` null is the whole hotel. */
export async function eraseGuestScans(db: Pick<Db, "select" | "delete">, hotelId: string, guestId: string | null) {
  await db
    .delete(whatsappScans)
    .where(and(eq(whatsappScans.hotelId, hotelId), guestId ? ofGuest(db, hotelId, guestId) : undefined))
}

/** The hotels that welcomed this number and still keep its scan. */
export const scanHotels = async (db: Db, phoneE164: string): Promise<string[]> =>
  (
    await db
      .select({ hotelId: whatsappScans.hotelId })
      .from(whatsappScans)
      .where(eq(whatsappScans.phoneE164, phoneE164))
  ).map((scan) => scan.hotelId)

/** A STOP: staff must not be prompted to write to this number again, at any hotel. */
export const forgetScans = (db: Db, phoneE164: string) =>
  db.delete(whatsappScans).where(eq(whatsappScans.phoneE164, phoneE164)).returning({ language: whatsappScans.language })

export const purgeOldScans = (db: Db, now: Date) =>
  db.delete(whatsappScans).where(lt(whatsappScans.lastScanAt, cutoff(now)))
