import { afterAll, beforeAll, expect, test } from "bun:test"
import { auditLog } from "@ritorno/db"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

async function member(email: string, hotelId: string, role: "owner" | "staff") {
  const user = await app.signUp(email)
  return app.joinHotel(user, hotelId, role)
}

async function hotel(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  return { hotelId, ownerId: owner.id, ...(await app.joinHotel(owner, hotelId, "owner")) }
}

test("a hotel reads only its own log, without platform identities, and staff are refused", async () => {
  const mine = await hotel("audit-mine")
  const other = await hotel("audit-other")
  const staff = await member("audit-staff@ritorno.test", mine.hotelId, "staff")
  const admin = await app.signUp("audit-admin@ritorno.test", { role: "admin" })
  await app.services.db.delete(auditLog)
  await app.services.db.insert(auditLog).values([
    { actorId: mine.ownerId, action: "guest.export-all", metadata: { hotelId: mine.hotelId }, ip: "10.0.0.1" },
    { actorId: admin.id, action: "hotel.admin-update", targetId: mine.hotelId, ip: "10.0.0.2" },
    { actorId: other.ownerId, action: "offer.create", metadata: { hotelId: other.hotelId } },
  ])

  const { entries } = await mine.client.audit.list({})
  expect(entries.map((entry) => [entry.action, entry.actorEmail, entry.platform]).sort()).toEqual([
    ["guest.export-all", "audit-mine@ritorno.test", false],
    ["hotel.admin-update", null, true],
  ])
  expect(Object.keys(entries[0]!).sort()).toEqual(["action", "actorEmail", "createdAt", "id", "platform"])
  expect((await mine.client.audit.list({ actorId: admin.id })).entries).toEqual([])
  const options = await mine.client.audit.filters()
  expect(options.actions).toEqual(["guest.export-all", "hotel.admin-update"])
  expect(options.actors.map((actor) => actor.id)).toEqual([mine.ownerId])
  await expect(staff.client.audit.list({})).rejects.toMatchObject({ code: "FORBIDDEN" })
})

test("date filters are days on the hotel's clock", async () => {
  const mine = await hotel("audit-days")
  await app.services.db.delete(auditLog)
  // Tunis is UTC+1: 23:30 UTC on the 9th is already the 10th there.
  await app.services.db.insert(auditLog).values({
    action: "offer.create",
    metadata: { hotelId: mine.hotelId },
    createdAt: new Date("2026-03-09T23:30:00Z"),
  })

  expect((await mine.client.audit.list({ from: "2026-03-10", to: "2026-03-10" })).entries).toHaveLength(1)
  expect((await mine.client.audit.list({ to: "2026-03-09" })).entries).toHaveLength(0)
})

test("the cursor walks the whole log once, even through rows with the same time", async () => {
  const mine = await hotel("audit-pages")
  const createdAt = new Date("2026-03-01T10:00:00Z")
  await app.services.db
    .insert(auditLog)
    .values(
      Array.from({ length: 105 }, () => ({ action: "note.delete", metadata: { hotelId: mine.hotelId }, createdAt })),
    )

  const first = await mine.client.audit.list({ action: "note.delete" })
  const second = await mine.client.audit.list({ action: "note.delete", cursor: first.nextCursor })
  expect(second.nextCursor).toBeNull()
  expect(new Set([...first.entries, ...second.entries].map((entry) => entry.id)).size).toBe(105)
})
