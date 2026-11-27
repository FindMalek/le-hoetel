import type { AuditAction } from "@ritorno/common/audit"
import { auditLog, type Db } from "@ritorno/db"
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api"

const INVITATION_PATHS = ["/organization/invite-member", "/organization/cancel-invitation"]

/**
 * Writes to the audit log what better-auth's own routes do: admin impersonation (who started it as whom, and when they
 * stopped) and a team's invitations. Ids only, never the invited address.
 */
export function auditHooks(db: Db) {
  return {
    databaseHooks: {
      session: {
        create: {
          after: async (session: { userId: string; impersonatedBy?: string | null }) => {
            if (!session.impersonatedBy) return
            await db.insert(auditLog).values({
              actorId: session.impersonatedBy,
              action: "admin.impersonate" satisfies AuditAction,
              targetId: session.userId,
            })
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (INVITATION_PATHS.includes(ctx.path)) {
          const done = ctx.context.returned as { id?: string; organizationId?: string } | undefined
          if (!ctx.request || done instanceof APIError || !done?.id) return
          const session = await getSessionFromCtx(ctx)
          const action: AuditAction =
            ctx.path === "/organization/cancel-invitation"
              ? "hotel.invitation-revoke"
              : ctx.body?.resend
                ? "hotel.invitation-resend"
                : "hotel.invitation-create"
          const impersonatedBy = session?.session.impersonatedBy
          await db.insert(auditLog).values({
            actorId: session?.user.id,
            action,
            targetId: done.id,
            metadata: { hotelId: done.organizationId, ...(impersonatedBy ? { impersonatedBy } : {}) },
            ip: ctx.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
          })
          return
        }
        if (ctx.path !== "/admin/stop-impersonating") return
        const adminId = ctx.context.newSession?.user.id
        if (adminId)
          await db.insert(auditLog).values({ actorId: adminId, action: "admin.impersonate-stop" satisfies AuditAction })
      }),
    },
  }
}
