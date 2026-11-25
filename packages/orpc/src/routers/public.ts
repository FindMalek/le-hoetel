import { MESSAGE_CHANNELS } from "@le-hoetel/common/consent"
import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import {
  CAPTURE_MIN_FILL_MS,
  CAPTURE_SOURCES,
  captureInputSchema,
  guestCreateSchema,
  offerPageSchema,
  publicHotelSchema,
  statusSchema,
} from "@le-hoetel/common/schemas"
import { hotelSettings, organization } from "@le-hoetel/db"
import { ORPCError } from "@orpc/server"
import { and, eq, ne, sql } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { enqueueWelcome } from "../jobs"
import { repoInfo } from "../lib/github"
import { upsertGuest } from "../lib/guests"
import { offerPage, welcomeOffer } from "../lib/offers"
import { enforceKey, enforceRateLimit, RATE_LIMITS } from "../lib/rate-limit"
import { changeChoices, unsubscribeAll, unsubscribePage } from "../lib/unsubscribe"
import { publicProcedure } from "../procedures"

const hotelNotFound = () => new ORPCError("NOT_FOUND", { message: "Hotel not found." })

async function findPublicHotel(db: Context["db"], slug: string) {
  const [hotel] = await db
    .select({
      id: organization.id,
      slug: organization.slug,
      displayName: hotelSettings.displayName,
      primaryColor: hotelSettings.primaryColor,
      accentColor: hotelSettings.accentColor,
      defaultLanguage: hotelSettings.defaultLanguage,
      logoKey: hotelSettings.logoKey,
    })
    .from(organization)
    .innerJoin(hotelSettings, eq(hotelSettings.organizationId, organization.id))
    .where(and(eq(organization.slug, slug), ne(hotelSettings.status, "suspended")))
  if (!hotel) throw hotelNotFound()
  return hotel
}

const token = z.string().min(20).max(400)
const channels = z.array(z.object({ channel: z.enum(MESSAGE_CHANNELS), granted: z.boolean() }))

const unsubscribeRouter = {
  get: publicProcedure
    .route({
      method: "POST",
      path: "/public/unsubscribe/get",
      summary: "The hotel and the switches behind an unsubscribe link",
      tags: ["public"],
    })
    .input(z.object({ token }))
    .output(
      z.object({
        hotel: z.object({
          displayName: z.string(),
          logoUrl: z.string().nullable(),
          primaryColor: z.string().nullable(),
          accentColor: z.string().nullable(),
        }),
        language: z.enum(HOTEL_LANGUAGES),
        channel: z.enum(MESSAGE_CHANNELS),
        channels,
      }),
    )
    .handler(({ context, input }) => unsubscribePage(context, input.token)),

  update: publicProcedure
    .route({
      method: "POST",
      path: "/public/unsubscribe/update",
      summary: "Switch message channels on or off for the guest behind a link",
      tags: ["public"],
    })
    .input(z.object({ token, email: z.boolean().optional(), whatsapp: z.boolean().optional() }))
    .output(channels)
    .handler(({ context, input }) =>
      changeChoices(context, input.token, { email: input.email, whatsapp: input.whatsapp }),
    ),

  all: publicProcedure
    .route({
      method: "POST",
      path: "/public/unsubscribe/all",
      summary: "One tap: stop every message from this hotel",
      tags: ["public"],
    })
    .input(z.object({ token }))
    .output(channels)
    .handler(({ context, input }) => unsubscribeAll(context, input.token)),
}

/** Bots get the same "ok" a guest gets, so they learn nothing: a filled honeypot, a form sent too fast, a link as a name. */
function looksLikeBot(input: z.output<typeof captureInputSchema>, now: Date): boolean {
  return (
    !!input.website || now.getTime() - input.renderedAt < CAPTURE_MIN_FILL_MS || /https?:\/\/|www\./i.test(input.name)
  )
}

export const publicRouter = {
  unsubscribe: unsubscribeRouter,

  offer: publicProcedure
    .route({
      method: "POST",
      path: "/public/offer",
      summary: "The offer and QR code behind a guest's link",
      tags: ["public"],
    })
    .input(z.object({ token }))
    .output(offerPageSchema)
    .handler(({ context, input }) => offerPage(context, input.token)),

  status: publicProcedure
    .route({ method: "GET", path: "/public/status", summary: "Live api and database health", tags: ["public"] })
    .output(statusSchema)
    .handler(async ({ context }) => {
      const started = performance.now()
      const up = await context.db
        .execute(sql`select 1`)
        .then(() => true)
        .catch(() => false)
      return {
        api: "ok" as const,
        database: up ? ("ok" as const) : ("down" as const),
        databaseMs: up ? Math.round(performance.now() - started) : null,
        env: context.config.deployEnv,
      }
    }),

  repo: publicProcedure
    .route({ method: "GET", path: "/public/repo", summary: "The project's GitHub repo and stars", tags: ["public"] })
    .output(z.object({ name: z.string(), url: z.string(), stars: z.number() }).nullable())
    .handler(async ({ context }) => {
      const info = await repoInfo(context.config.githubRepo, context.config.githubToken)
      return info && context.config.githubRepo ? { name: context.config.githubRepo, ...info } : null
    }),

  authProviders: publicProcedure
    .route({ method: "GET", path: "/public/auth-providers", summary: "Sign-in methods enabled here", tags: ["public"] })
    .output(z.object({ email: z.boolean(), github: z.boolean() }))
    .handler(({ context }) => ({ email: true, github: context.config.githubAuth })),

  hotel: publicProcedure
    .route({
      method: "GET",
      path: "/public/hotels/{slug}",
      summary: "The public branding of a hotel, for its QR capture page",
      tags: ["public"],
    })
    .input(z.object({ slug: z.string().min(1).max(100) }))
    .output(publicHotelSchema)
    .handler(async ({ context, input }) => {
      const { id, logoKey, ...hotel } = await findPublicHotel(context.db, input.slug)
      return {
        ...hotel,
        logoUrl: logoKey ? `${context.config.apiUrl}/files/${logoKey}` : null,
        welcomeOffer: await welcomeOffer(context.db, id, context.now()),
      }
    }),

  capture: publicProcedure
    .route({
      method: "POST",
      path: "/public/hotels/{slug}/guests",
      summary: "A guest signs up from a QR code: name, phone, language and their own consents",
      tags: ["public"],
    })
    .input(captureInputSchema)
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      await enforceRateLimit(context, "capture.ip", RATE_LIMITS.captureIp)
      const hotel = await findPublicHotel(context.db, input.slug)
      if (looksLikeBot(input, context.now())) return { ok: true as const }
      await enforceKey(context.rateLimiter, `public.capture:hotel:${hotel.id}`, RATE_LIMITS.captureHotel)
      const guest = guestCreateSchema.safeParse({
        name: input.name,
        phone: input.phone,
        language: input.language,
        email: input.email,
        birthday: input.birthday,
        source: CAPTURE_SOURCES[input.source],
        captureLocation: input.location,
        consents: { ...input.consents, profile: false },
      })
      if (!guest.success) {
        throw new ORPCError("BAD_REQUEST", { message: guest.error.issues[0]?.message ?? "Check your details." })
      }
      const { id } = await context.db.transaction((tx) => upsertGuest(tx, hotel.id, guest.data, context.now()))
      await enqueueWelcome(context, hotel.id, id, guest.data.consents)
      return { ok: true as const }
    }),
}
