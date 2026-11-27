import { afterAll, beforeAll, expect, test } from "bun:test"
import { auditLog, invitation } from "@ritorno/db"
import { asc, eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
const mails: { to: string }[] = []

beforeAll(async () => {
  app = await createTestApp()
  app.services.notification = {
    ...app.services.notification,
    channels: ["email"],
    send: async (input) => {
      mails.push({ to: input.to ?? "" })
      return { ok: true } as never
    },
  }
})
afterAll(() => app.close())

const accept = (id: string, headers: Headers) =>
  app.services.auth.api.acceptInvitation({ body: { invitationId: id }, headers })

const actions = async (targetId: string) =>
  (
    await app.services.db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(eq(auditLog.targetId, targetId))
      .orderBy(asc(auditLog.createdAt))
  ).map((row) => row.action)

async function setup(slug: string) {
  const admin = await app.signUp(`admin@${slug}.com`, { role: "admin" })
  const hotelId = await app.createHotel(slug, await app.signUp(`first@${slug}.com`))
  return { admin, hotelId, invitations: admin.client.admin.hotels.invitations }
}

test("an admin invites an owner to an existing hotel, resends an expired invite and the owner joins", async () => {
  const { admin, hotelId, invitations } = await setup("dar")
  const { invitationId, emailed } = await invitations.create({ id: hotelId, email: "Second@dar.com" })
  expect(emailed).toBe(true)
  await expect(invitations.create({ id: hotelId, email: "second@dar.com" })).rejects.toMatchObject({ code: "CONFLICT" })
  await expect(invitations.create({ id: hotelId, email: "first@dar.com" })).rejects.toMatchObject({ code: "CONFLICT" })

  await app.services.db
    .update(invitation)
    .set({ expiresAt: new Date(0) })
    .where(eq(invitation.id, invitationId))
  await invitations.resend({ id: hotelId, invitationId })
  expect(mails.map((mail) => mail.to)).toEqual(["second@dar.com", "second@dar.com"])

  const second = await app.signUp("second@dar.com")
  await accept(invitationId, second.headers)
  const detail = await admin.client.admin.hotels.get({ id: hotelId })
  expect(detail.members.find((person) => person.userId === second.id)?.role).toBe("owner")
  expect(await actions(invitationId)).toEqual(["hotel.invitation-create", "hotel.invitation-resend"])
})

test("a revoked invite is dead, and only an admin acting on its own hotel can revoke it", async () => {
  const { hotelId, invitations } = await setup("riad")
  const other = await app.createHotel("bey", await app.signUp("first@bey.com"))
  const { invitationId } = await invitations.create({ id: hotelId, email: "gone@riad.com" })

  await expect(invitations.revoke({ id: other, invitationId })).rejects.toMatchObject({ code: "NOT_FOUND" })
  const owner = await app.signUp("plain@riad.com")
  await expect(owner.client.admin.hotels.invitations.revoke({ id: hotelId, invitationId })).rejects.toMatchObject({
    code: "FORBIDDEN",
  })
  await invitations.revoke({ id: hotelId, invitationId })

  const invited = await app.signUp("gone@riad.com")
  await expect(accept(invitationId, invited.headers)).rejects.toThrow("Invitation not found")
  await expect(invitations.resend({ id: hotelId, invitationId })).rejects.toMatchObject({ code: "NOT_FOUND" })
  expect(await actions(invitationId)).toEqual(["hotel.invitation-create", "hotel.invitation-revoke"])
})

test("resending cannot bring back the invite of a sender who is gone", async () => {
  const { hotelId, invitations } = await setup("kasbah")
  const manager = await app.joinHotel(await app.signUp("manager@kasbah.com"), hotelId, "manager")
  const created = await app.services.auth.api.createInvitation({
    body: { email: "second@kasbah.com", role: "staff", organizationId: hotelId },
    headers: manager.headers,
  })
  await app.services.auth.api.leaveOrganization({ body: { organizationId: hotelId }, headers: manager.headers })
  await expect(invitations.resend({ id: hotelId, invitationId: created.id })).rejects.toMatchObject({
    code: "CONFLICT",
  })
})

test("a team's own invite, resend and revoke are audited", async () => {
  const owner = await app.signUp("owner@team.com")
  const hotelId = await app.createHotel("team", owner)
  const post = async (path: string, body: object) => {
    const headers = new Headers(owner.headers)
    headers.set("content-type", "application/json")
    headers.set("origin", "http://localhost:3002")
    const request = new Request(`http://localhost:3002/api/auth/organization/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })
    const response = await app.services.auth.handler(request)
    return (await response.json()) as { id: string }
  }
  const invite = { email: "desk@team.com", role: "staff", organizationId: hotelId }
  const { id } = await post("invite-member", invite)
  await post("invite-member", { ...invite, resend: true })
  await post("cancel-invitation", { invitationId: id })
  // refused: nothing happened, so nothing is recorded
  await post("cancel-invitation", { invitationId: "nope" })

  expect(await actions(id)).toEqual(["hotel.invitation-create", "hotel.invitation-resend", "hotel.invitation-revoke"])
  const rows = await app.services.db.select().from(auditLog).where(eq(auditLog.targetId, id))
  expect(rows.map((row) => [row.actorId, row.metadata])).toEqual(Array(3).fill([owner.id, { hotelId }]))
})
