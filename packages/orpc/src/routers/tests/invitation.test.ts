import { afterAll, beforeAll, expect, test } from "bun:test"
import { invitation, member } from "@ritorno/db"
import { and, eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("the invited owner reads an invitation whose inviter left the hotel, nobody else does", async () => {
  const admin = await app.signUp("admin@example.com", { role: "admin" })
  const hotel = await admin.client.admin.hotels.create({ name: "Dar", slug: "dar", ownerEmail: "owner@example.com" })
  expect(await app.services.db.select().from(member).where(eq(member.organizationId, hotel.id))).toEqual([])
  const detail = await admin.client.admin.hotels.get({ id: hotel.id })
  const id = detail.invitations[0]?.id ?? ""

  const owner = await app.signUp("owner@example.com")
  expect(await owner.client.me.invitation({ id })).toEqual({
    organizationName: "Dar",
    inviterEmail: "admin@example.com",
    role: "owner",
  })
  const other = await app.signUp("other@example.com")
  await expect(other.client.me.invitation({ id })).rejects.toMatchObject({ code: "FORBIDDEN" })
})

/** A hotel with an owner and a manager, and a way for the manager to invite someone. */
async function hotelWithManager(slug: string) {
  const owner = await app.signUp(`owner@${slug}.com`)
  const hotelId = await app.createHotel(slug, owner)
  const manager = await app.joinHotel(await app.signUp(`manager@${slug}.com`), hotelId, "manager")
  const invite = async (email: string) => {
    const created = await app.services.auth.api.createInvitation({
      body: { email, role: "staff", organizationId: hotelId },
      headers: manager.headers,
    })
    return created.id
  }
  return { hotelId, manager, invite }
}

const accept = (id: string, headers: Headers) =>
  app.services.auth.api.acceptInvitation({ body: { invitationId: id }, headers })

test("a removed manager's invite is dead, an admin's invite still works after the admin left", async () => {
  const { hotelId, manager, invite } = await hotelWithManager("riad")
  const id = await invite("second@riad.com")
  const second = await app.signUp("second@riad.com")
  await app.services.db.delete(member).where(and(eq(member.organizationId, hotelId), eq(member.userId, manager.id)))
  await expect(accept(id, second.headers)).rejects.toThrow("Invitation not found")
  await expect(second.client.me.invitation({ id })).rejects.toMatchObject({ code: "NOT_FOUND" })

  const admin = await app.signUp("admin@riad.com", { role: "admin" })
  const created = await admin.client.admin.hotels.create({ name: "Bey", slug: "bey", ownerEmail: "owner@bey.com" })
  const detail = await admin.client.admin.hotels.get({ id: created.id })
  const owner = await app.signUp("owner@bey.com")
  await accept(detail.invitations[0]?.id ?? "", owner.headers)
  const members = await app.services.db.select().from(member).where(eq(member.organizationId, created.id))
  expect(members.map((row) => row.userId)).toEqual([owner.id])
})

test("an expired or cancelled invitation reads as gone", async () => {
  const { manager, invite } = await hotelWithManager("kasbah")
  const expired = await invite("late@kasbah.com")
  await app.services.db
    .update(invitation)
    .set({ expiresAt: new Date(0) })
    .where(eq(invitation.id, expired))
  const cancelled = await invite("gone@kasbah.com")
  await app.services.auth.api.cancelInvitation({ body: { invitationId: cancelled }, headers: manager.headers })

  for (const [id, email] of [
    [expired, "late@kasbah.com"],
    [cancelled, "gone@kasbah.com"],
  ] as const) {
    const invitee = await app.signUp(email)
    await expect(invitee.client.me.invitation({ id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  }
})
