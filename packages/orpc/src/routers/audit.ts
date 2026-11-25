import { ADMIN_LIST_LIMIT } from "@ritorno/common/constants"
import { auditLog, hotelSettings, user } from "@ritorno/db"
import { and, desc, eq, gte, ilike, lt, sql } from "drizzle-orm"
import { z } from "zod"
import { adminProcedure } from "../procedures"

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

const filterSchema = z.object({
  action: z.string().trim().max(80).optional(),
  actorId: z.string().optional(),
  hotelId: z.string().optional(),
  from: z.date().optional(),
  to: z.date().optional(),
})

/** The hotel an entry is about: the one the actor worked on, else the target when it is a hotel itself. */
const entryHotelId = sql<string | null>`coalesce(${auditLog.metadata}->>'hotelId', ${hotelSettings.organizationId})`

export const auditRouter = {
  list: adminProcedure
    .route({
      method: "GET",
      path: "/admin/audit",
      summary: "The audit log, newest first, filtered by actor, action, hotel and dates (admins only)",
      tags: ["admin"],
    })
    .input(filterSchema.extend({ offset: z.number().int().min(0).default(0) }).default({ offset: 0 }))
    .output(z.object({ entries: z.array(entrySchema), hasMore: z.boolean() }))
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
        .leftJoin(
          hotelSettings,
          eq(hotelSettings.organizationId, sql`coalesce(${auditLog.metadata}->>'hotelId', ${auditLog.targetId})`),
        )
        .where(
          and(
            input.action
              ? input.action.endsWith(".")
                ? ilike(auditLog.action, `${input.action.replace(/[\\%_]/g, "\\$&")}%`)
                : eq(auditLog.action, input.action)
              : undefined,
            input.actorId ? eq(auditLog.actorId, input.actorId) : undefined,
            input.hotelId
              ? sql`coalesce(${auditLog.metadata}->>'hotelId', ${auditLog.targetId}) = ${input.hotelId}`
              : undefined,
            input.from ? gte(auditLog.createdAt, input.from) : undefined,
            input.to ? lt(auditLog.createdAt, input.to) : undefined,
          ),
        )
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(ADMIN_LIST_LIMIT + 1)
        .offset(input.offset)
      return { entries: rows.slice(0, ADMIN_LIST_LIMIT), hasMore: rows.length > ADMIN_LIST_LIMIT }
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
