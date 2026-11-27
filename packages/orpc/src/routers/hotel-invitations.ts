import { randomUUID } from "node:crypto"
import { ORPCError } from "@orpc/server"
import { INVITATION_TTL_SECONDS, inviterMayInvite } from "@ritorno/auth"
import { emailSchema } from "@ritorno/common/schemas"
import { invitation, member, organization, user } from "@ritorno/db"
import { logger } from "@ritorno/logger"
import { authEmails } from "@ritorno/notification"
import { and, eq, sql } from "drizzle-orm"
import { z } from "zod"
import type { Context } from "../context"
import { audit } from "../lib/audit"
import { adminProcedure } from "../procedures"

// Not better-auth's invite routes: they only serve members of the hotel, and the app admin is not one.

const target = z.object({ id: z.string(), invitationId: z.string() })
/** `emailed` is false when no email left (not configured, or the provider failed): the link is then sent by hand. */
const sent = z.object({ invitationId: z.string(), emailed: z.boolean() })

const expiry = (context: Context) => new Date(context.now().getTime() + INVITATION_TTL_SECONDS * 1000)

const pendingOf = (hotelId: string, invitationId: string) =>
  and(eq(invitation.id, invitationId), eq(invitation.organizationId, hotelId), eq(invitation.status, "pending"))

async function email(
  context: Context & { user: { name: string } },
  invite: { id: string; email: string; role: string; hotelId: string },
): Promise<boolean> {
  const send = authEmails(context.notification).sendInvitation
  if (!send) return false
  try {
    await send({
      email: invite.email,
      role: invite.role,
      inviter: context.user.name,
      url: `${context.config.dashboardUrl}/accept-invitation/${invite.id}`,
    })
    return true
  } catch {
    // the provider's error can carry the address: only ids are logged
    logger.warn("invitation email failed", { hotelId: invite.hotelId, invitationId: invite.id })
    return false
  }
}

export const adminInvitationsRouter = {
  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/hotels/{id}/invitations",
      summary: "Invite an owner to an existing hotel (admins only)",
      tags: ["admin"],
    })
    .input(z.object({ id: z.string(), email: emailSchema }))
    .output(sent)
    .handler(async ({ context, input }) => {
      const { db } = context
      const address = input.email.toLowerCase()
      const [hotel] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, input.id))
      if (!hotel) throw new ORPCError("NOT_FOUND", { message: "Hotel not found." })
      const [joined] = await db
        .select({ id: member.id })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(and(eq(member.organizationId, input.id), eq(sql`lower(${user.email})`, address)))
      if (joined) throw new ORPCError("CONFLICT", { message: "That person is already a member of this hotel." })
      const mine = and(
        eq(invitation.organizationId, input.id),
        eq(invitation.email, address),
        eq(invitation.status, "pending"),
      )
      const waiting = await db.select({ expiresAt: invitation.expiresAt }).from(invitation).where(mine)
      if (waiting.some((row) => row.expiresAt > context.now())) {
        throw new ORPCError("CONFLICT", { message: "That email already has a pending invitation." })
      }
      // expired ones would stay in the list next to the new invitation
      if (waiting.length) await db.update(invitation).set({ status: "canceled" }).where(mine)
      const id = randomUUID()
      await db.insert(invitation).values({
        id,
        organizationId: input.id,
        email: address,
        role: "owner",
        expiresAt: expiry(context),
        inviterId: context.user.id,
      })
      await audit(context, { action: "hotel.invitation-create", targetId: id, metadata: { hotelId: input.id } })
      return {
        invitationId: id,
        emailed: await email(context, { id, email: address, role: "owner", hotelId: input.id }),
      }
    }),

  resend: adminProcedure
    .route({
      method: "POST",
      path: "/admin/hotels/{id}/invitations/{invitationId}/resend",
      summary: "Email a pending invitation again and restart its expiry (admins only)",
      tags: ["admin"],
    })
    .input(target)
    .output(sent)
    .handler(async ({ context, input }) => {
      const [row] = await context.db.select().from(invitation).where(pendingOf(input.id, input.invitationId))
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Invitation not found." })
      // a new expiry must not bring back the invite of a removed or banned sender
      if (!(await inviterMayInvite(context.db, row))) {
        throw new ORPCError("CONFLICT", { message: "Its sender left the hotel. Revoke it and invite again." })
      }
      await context.db
        .update(invitation)
        .set({ expiresAt: expiry(context) })
        .where(pendingOf(input.id, row.id))
      await audit(context, { action: "hotel.invitation-resend", targetId: row.id, metadata: { hotelId: input.id } })
      const invite = { id: row.id, email: row.email, role: row.role ?? "staff", hotelId: input.id }
      return { invitationId: row.id, emailed: await email(context, invite) }
    }),

  revoke: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/hotels/{id}/invitations/{invitationId}",
      summary: "Revoke a pending invitation, its link stops working (admins only)",
      tags: ["admin"],
    })
    .input(target)
    .output(z.object({ ok: z.literal(true) }))
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .update(invitation)
        .set({ status: "canceled" })
        .where(pendingOf(input.id, input.invitationId))
        .returning({ id: invitation.id })
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Invitation not found." })
      await audit(context, { action: "hotel.invitation-revoke", targetId: row.id, metadata: { hotelId: input.id } })
      return { ok: true as const }
    }),
}
