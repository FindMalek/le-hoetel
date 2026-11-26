import { ADMIN_LIST_LIMIT } from "@ritorno/common/constants"
import { auditLog, hotelSettings, member, user } from "@ritorno/db"
import { and, desc, eq, gte, ilike, lt, type SQL, sql } from "drizzle-orm"
import { z } from "zod"
import { adminProcedure, can, hotelProcedure } from "../procedures"

const entrySchema = z.object({
  id: z.string(),
  actorId: z.string().nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  ip: z.string().nullable(),
  hotelId: z.string().nullable(),
  hotelName: z.string().nullable(),
  createdAt: z.date(),
})

/** What a hotel reads of its own log: no ip, no metadata, and nothing that names a platform admin. */
const hotelEntrySchema = z.object({
  id: z.string(),
  actorEmail: z.string().nullable(),
  /** Done by Ritorno staff: not on the hotel's team, or signed in as someone who is. */
  platform: z.boolean(),
  action: z.string(),
  createdAt: z.date(),
})

const actionFilter = z.string().trim().max(80).optional()
const cursorSchema = z.uuid().nullish()

const filterSchema = z.object({
  action: actionFilter,
  actorId: z.string().optional(),
  hotelId: z.string().optional(),
  from: z.date().optional(),
  to: z.date().optional(),
  cursor: cursorSchema,
})

const hotelFilterSchema = z.object({
  action: actionFilter,
  actorId: z.string().optional(),
  /** Days on the hotel's calendar, both included. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  cursor: cursorSchema,
})

/** The hotel an entry is about: the one the actor worked on, else the target when it is a hotel itself. */
const aboutHotel = sql<string | null>`coalesce(${auditLog.metadata}->>'hotelId', ${auditLog.targetId})`
const entryHotelId = sql<string | null>`coalesce(${auditLog.metadata}->>'hotelId', ${hotelSettings.organizationId})`

/** The rows a hotel reads: those about it, less our own billing work. The admin log keeps everything. */
const hotelRows = (hotelId: string) => sql`${aboutHotel} = ${hotelId} and ${auditLog.action} <> 'billing.export'`

/** An action name, or every action of a noun when it ends with a dot (`guest.`). */
const ofAction = (action: string | undefined): SQL | undefined => {
  if (!action) return undefined
  return action.endsWith(".")
    ? ilike(auditLog.action, `${action.replace(/[\\%_]/g, "\\$&")}%`)
    : eq(auditLog.action, action)
}

/** Keyset paging: rows older than the cursor row. Compared in the database, which keeps the microseconds a Date drops. */
const olderThan = (cursor: string | null | undefined, scope?: SQL): SQL | undefined =>
  cursor
    ? sql`(${auditLog.createdAt}, ${auditLog.id}) < (select created_at, id from ${auditLog} where ${and(sql`id = ${cursor}`, scope)})`
    : undefined

const newestFirst = [desc(auditLog.createdAt), desc(auditLog.id)] as const

const page = <T extends { id: string }>(rows: T[]) => {
  const entries = rows.slice(0, ADMIN_LIST_LIMIT)
  return { entries, nextCursor: rows.length > ADMIN_LIST_LIMIT ? entries[entries.length - 1]!.id : null }
}

export const adminAuditRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/audit",
      summary: "The audit log, newest first, filtered by actor, action, hotel and dates (admins only)",
      tags: ["admin"],
    })
    .input(filterSchema.default({}))
    .output(z.object({ entries: z.array(entrySchema), nextCursor: z.string().nullable() }))
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .select({
          id: auditLog.id,
          actorId: auditLog.actorId,
          actorEmail: user.email,
          action: auditLog.action,
          targetId: auditLog.targetId,
          metadata: auditLog.metadata,
          ip: auditLog.ip,
          hotelId: entryHotelId,
          hotelName: hotelSettings.displayName,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(user, eq(user.id, auditLog.actorId))
        .leftJoin(hotelSettings, eq(hotelSettings.organizationId, aboutHotel))
        .where(
          and(
            ofAction(input.action),
            input.actorId ? eq(auditLog.actorId, input.actorId) : undefined,
            input.hotelId ? sql`${aboutHotel} = ${input.hotelId}` : undefined,
            input.from ? gte(auditLog.createdAt, input.from) : undefined,
            input.to ? lt(auditLog.createdAt, input.to) : undefined,
            olderThan(input.cursor),
          ),
        )
        .orderBy(...newestFirst)
        .limit(ADMIN_LIST_LIMIT + 1)
      return page(rows)
    }),

  actions: adminProcedure
    .route({
      method: "GET",
      path: "/admin/audit/actions",
      summary: "Every action name in the audit log",
      tags: ["admin"],
    })
    .output(z.array(z.string()))
    .handler(async ({ context }) => {
      const rows = await context.db.selectDistinct({ action: auditLog.action }).from(auditLog).orderBy(auditLog.action)
      return rows.map((row) => row.action)
    }),
}

/** Owners and managers. Staff can't read who did what. */
const auditReader = hotelProcedure.use(can({ organization: ["update"] }))

/** Ritorno did it: a platform admin off this hotel's team, or one signed in as the actor. Needs both joins below. */
const isPlatform = sql<boolean>`(${auditLog.metadata}->>'impersonatedBy' is not null or coalesce(${user.role} = 'admin' and ${member.id} is null, false))`
const teamOf = (hotelId: string) => and(eq(member.userId, auditLog.actorId), eq(member.organizationId, hotelId))

export const hotelAuditRouter = {
  list: auditReader
    .route({
      method: "GET",
      path: "/audit",
      summary: "The hotel's audit log, newest first, filtered by actor, action and dates (owners and managers)",
      tags: ["hotel"],
    })
    .input(hotelFilterSchema.default({}))
    .output(z.object({ entries: z.array(hotelEntrySchema), nextCursor: z.string().nullable() }))
    .handler(async ({ context, input }) => {
      const { hotelId } = context.hotel
      const mine = hotelRows(hotelId)
      const timezone = sql`coalesce((select timezone from ${hotelSettings} where organization_id = ${hotelId}), 'UTC')`
      const rows = await context.db
        .select({
          id: auditLog.id,
          actorEmail: sql<string | null>`case when ${isPlatform} then null else ${user.email} end`,
          platform: isPlatform,
          action: auditLog.action,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(user, eq(user.id, auditLog.actorId))
        .leftJoin(member, teamOf(hotelId))
        .where(
          and(
            mine,
            ofAction(input.action),
            // What Ritorno did is nobody's in the person filter, whoever's account it ran on.
            input.actorId ? and(eq(auditLog.actorId, input.actorId), sql`not ${isPlatform}`) : undefined,
            input.from
              ? sql`${auditLog.createdAt} >= (${input.from}::date::timestamp at time zone ${timezone})`
              : undefined,
            input.to
              ? sql`${auditLog.createdAt} < ((${input.to}::date + 1)::timestamp at time zone ${timezone})`
              : undefined,
            olderThan(input.cursor, mine),
          ),
        )
        .orderBy(...newestFirst)
        .limit(ADMIN_LIST_LIMIT + 1)
      return page(rows)
    }),

  filters: auditReader
    .route({
      method: "GET",
      path: "/audit/filters",
      summary: "The actions and people in the hotel's audit log, and the timezone its dates are read in",
      tags: ["hotel"],
    })
    .output(
      z.object({
        timezone: z.string(),
        actions: z.array(z.string()),
        actors: z.array(z.object({ id: z.string(), email: z.string() })),
      }),
    )
    .handler(async ({ context }) => {
      const { hotelId } = context.hotel
      const mine = hotelRows(hotelId)
      const [[settings], actions, actors] = await Promise.all([
        context.db
          .select({ timezone: hotelSettings.timezone })
          .from(hotelSettings)
          .where(eq(hotelSettings.organizationId, hotelId)),
        context.db.selectDistinct({ action: auditLog.action }).from(auditLog).where(mine).orderBy(auditLog.action),
        context.db
          .selectDistinct({ id: user.id, email: user.email })
          .from(auditLog)
          .innerJoin(user, eq(user.id, auditLog.actorId))
          .leftJoin(member, teamOf(hotelId))
          .where(and(mine, sql`not ${isPlatform}`))
          .orderBy(user.email),
      ])
      return { timezone: settings?.timezone ?? "UTC", actions: actions.map((row) => row.action), actors }
    }),
}
