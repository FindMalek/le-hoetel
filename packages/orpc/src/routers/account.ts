import { ORPCError } from "@orpc/server"
import { ADMIN_LIST_LIMIT } from "@ritorno/common/constants"
import { adminUserSchema, meSchema, okSchema, profileInputSchema } from "@ritorno/common/schemas"
import { hotelSettings, member, session, user } from "@ritorno/db"
import { count, desc, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { audit } from "../lib/audit"
import { adminProcedure, protectedProcedure } from "../procedures"

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }

export const meRouter = {
  get: protectedProcedure
    .route({ method: "GET", path: "/me", summary: "The signed-in user", tags: ["account"] })
    .output(meSchema)
    .handler(async ({ context }) => {
      // The session is cookie cached for minutes, so a rename or new avatar would show up late: read the row.
      const [row] = await context.db
        .select({ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role })
        .from(user)
        .where(eq(user.id, context.user.id))
      if (!row) throw new ORPCError("UNAUTHORIZED", { message: "Please sign in." })
      return row
    }),

  update: protectedProcedure
    .route({ method: "PATCH", path: "/me", summary: "Update your profile", tags: ["account"] })
    .input(profileInputSchema)
    .output(okSchema)
    .handler(async ({ context, input }) => {
      await context.db
        .update(user)
        .set({ name: input.name, updatedAt: context.now() })
        .where(eq(user.id, context.user.id))
      await audit(context, { action: "profile.update", targetId: context.user.id })
      return { ok: true as const }
    }),

  avatar: protectedProcedure
    .route({ method: "POST", path: "/me/avatar", summary: "Upload a profile picture to S3", tags: ["account"] })
    .input(z.object({ file: z.instanceof(File) }))
    .output(z.object({ image: z.string() }))
    .handler(async ({ context, input }) => {
      if (!context.storage) throw new ORPCError("SERVICE_UNAVAILABLE", { message: "Storage isn't configured here." })
      const ext = IMAGE_TYPES[input.file.type]
      if (!ext) throw new ORPCError("UNSUPPORTED_MEDIA_TYPE", { message: "Use a JPEG, PNG or WebP image." })
      if (input.file.size > 4 * 1024 * 1024) throw new ORPCError("PAYLOAD_TOO_LARGE", { message: "4 MB at most." })
      const key = `${context.storage.prefix}avatars/${context.user.id}-${Date.now()}.${ext}`
      await context.storage.put(key, await input.file.arrayBuffer(), input.file.type)
      const image = `/api/files/${key}`
      await context.db.update(user).set({ image, updatedAt: context.now() }).where(eq(user.id, context.user.id))
      return { image }
    }),
}

export const adminRouter = {
  users: adminProcedure
    .route({ method: "GET", path: "/admin/users", summary: "All users (admins only)", tags: ["admin"] })
    .output(
      z.object({
        total: z.number(),
        users: z.array(adminUserSchema),
      }),
    )
    .handler(async ({ context }) => {
      const [total] = await context.db.select({ n: count() }).from(user)
      const users = await context.db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          banned: user.banned,
          createdAt: user.createdAt,
        })
        .from(user)
        .orderBy(desc(user.createdAt))
        .limit(ADMIN_LIST_LIMIT)
      const memberships = users.length
        ? await context.db
            .select({
              userId: member.userId,
              id: member.organizationId,
              name: hotelSettings.displayName,
              role: member.role,
            })
            .from(member)
            .innerJoin(hotelSettings, eq(hotelSettings.organizationId, member.organizationId))
            .where(
              inArray(
                member.userId,
                users.map((row) => row.id),
              ),
            )
        : []
      return {
        total: total?.n ?? 0,
        users: users.map((row) => ({
          ...row,
          banned: row.banned ?? false,
          hotels: memberships.filter((m) => m.userId === row.id).map(({ id, name, role }) => ({ id, name, role })),
        })),
      }
    }),
  setBanned: adminProcedure
    .route({
      method: "POST",
      path: "/admin/users/banned",
      summary: "Ban a user (signs them out everywhere) or lift the ban (admins only)",
      tags: ["admin"],
    })
    .input(z.object({ userId: z.string(), banned: z.boolean() }))
    .output(okSchema)
    .handler(async ({ context, input }) => {
      if (input.userId === context.user.id) throw new ORPCError("BAD_REQUEST", { message: "You can't ban yourself." })
      const [row] = await context.db
        .update(user)
        .set({ banned: input.banned, banReason: null, banExpires: null, updatedAt: context.now() })
        .where(eq(user.id, input.userId))
        .returning({ id: user.id })
      if (!row) throw new ORPCError("NOT_FOUND", { message: "User not found." })
      if (input.banned) await context.db.delete(session).where(eq(session.userId, input.userId))
      await audit(context, { action: input.banned ? "admin.user-ban" : "admin.user-unban", targetId: input.userId })
      return { ok: true as const }
    }),
}
