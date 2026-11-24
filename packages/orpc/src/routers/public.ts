import { MESSAGE_CHANNELS } from "@le-hoetel/common/consent"
import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import { statusSchema } from "@le-hoetel/common/schemas"
import { sql } from "drizzle-orm"
import { z } from "zod"
import { repoInfo } from "../lib/github"
import { changeChoices, unsubscribeAll, unsubscribePage } from "../lib/unsubscribe"
import { publicProcedure } from "../procedures"

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

export const publicRouter = {
  unsubscribe: unsubscribeRouter,

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
}
