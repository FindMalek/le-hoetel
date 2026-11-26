import { afterAll, beforeAll, expect, test } from "bun:test"
import { feedbackCases, surveyResponses } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

/** A hotel with a staff member and one guest who left 3/10. */
async function unhappy(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client: manager } = await app.joinHotel(owner, hotelId, "owner")
  const staffUser = await app.signUp(`${slug}-staff@ritorno.test`)
  const { client: staff } = await app.joinHotel(staffUser, hotelId, "staff")
  const guest = await manager.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620555555",
    language: "fr",
    source: "staff",
    consents: { email: false, whatsapp: false, profile: false },
  })
  const [response] = await app.services.db
    .insert(surveyResponses)
    .values({ hotelId, guestId: guest.id, inviteId: crypto.randomUUID(), nps: 3, language: "fr" })
    .returning()
  const [made] = await app.services.db.insert(feedbackCases).values({ hotelId, responseId: response!.id }).returning()
  return { hotelId, manager, staff, guestId: guest.id, id: made!.id }
}

const stored = async (id: string) =>
  (await app.services.db.select().from(feedbackCases).where(eq(feedbackCases.id, id)))[0]

test("staff move a case along and keep notes, and the list counts per status", async () => {
  const { staff, id } = await unhappy("cases-follow-up")

  await staff.feedbackCases.update({ id, status: "contacted", notes: "Called, offered a late check-out" })
  const updated = await staff.feedbackCases.update({ id, status: "resolved" })

  expect(updated).toMatchObject({ status: "resolved", notes: "Called, offered a late check-out" })
  expect(updated.handledBy).toBeString()
  const resolved = await staff.feedbackCases.list({ status: "resolved" })
  expect(resolved).toMatchObject({ total: 1, counts: { new: 0, contacted: 0, resolved: 1 } })
  expect(resolved.items).toMatchObject([{ id, name: "Amel Ben Salah", nps: 3 }])
  expect((await staff.feedbackCases.list({ status: "new" })).items).toHaveLength(0)
})

test("another hotel cannot list, read or change a case", async () => {
  const mine = await unhappy("cases-mine")
  const other = await unhappy("cases-other")

  expect((await other.manager.feedbackCases.list()).items.map((item) => item.id)).toEqual([other.id])
  await expect(other.manager.feedbackCases.get({ id: mine.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  await expect(other.manager.feedbackCases.update({ id: mine.id, notes: "x" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  })
  expect((await stored(mine.id))?.notes).toBeNull()
})

test("the guest exports carry the notes", async () => {
  const { manager, guestId, id } = await unhappy("cases-export")
  await manager.feedbackCases.update({ id, notes: "Noisy room 12" })

  const expected = [{ status: "new", notes: "Noisy room 12", nps: 3 }]
  expect((await manager.guests.export({ id: guestId })).feedback).toMatchObject(expected)
  expect((await manager.guests.exportAll()).guests[0]?.feedback).toMatchObject(expected)
  expect((await manager.guests.exportCsv({ id: guestId })).csv).toContain("Noisy room 12")
})

test("deleting a guest, one or all, erases the notes and drops the case from the inbox", async () => {
  const one = await unhappy("cases-delete-one")
  await one.manager.feedbackCases.update({ id: one.id, notes: "private" })
  await one.manager.guests.remove({ id: one.guestId })
  expect((await stored(one.id))?.notes).toBeNull()
  expect((await one.manager.feedbackCases.list()).total).toBe(0)

  const all = await unhappy("cases-delete-all")
  await all.manager.feedbackCases.update({ id: all.id, notes: "private" })
  await all.manager.guests.removeAll({ confirmCount: 1 })
  expect((await stored(all.id))?.notes).toBeNull()
})
