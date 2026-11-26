import { afterAll, beforeAll, expect, test } from "bun:test"
import { feedbackCases, guests, surveyResponses } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { eraseFeedbackNotes } from "../../lib/feedback-cases"
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
    .values({
      hotelId,
      guestId: guest.id,
      inviteId: crypto.randomUUID(),
      nps: 3,
      comment: "No hot water",
      language: "fr",
    })
    .returning()
  const [made] = await app.services.db.insert(feedbackCases).values({ hotelId, responseId: response!.id }).returning()
  /** Save on top of whatever is stored now, like a page just loaded. */
  const save = async (client: typeof manager, change: { status?: "contacted" | "resolved"; notes?: string }) => {
    const { updatedAt } = await client.feedbackCases.get({ id: made!.id })
    return client.feedbackCases.update({ id: made!.id, updatedAt, ...change })
  }
  return { hotelId, manager, staff, save, guestId: guest.id, id: made!.id }
}

const stored = async (id: string) =>
  (await app.services.db.select().from(feedbackCases).where(eq(feedbackCases.id, id)))[0]

test("staff move a case along and keep notes, and the list counts per status", async () => {
  const { staff, save, id } = await unhappy("cases-follow-up")

  await save(staff, { status: "contacted", notes: "Called, offered a late check-out" })
  const updated = await save(staff, { status: "resolved" })

  expect(updated).toMatchObject({ status: "resolved", notes: "Called, offered a late check-out" })
  expect(updated.handledBy).toBeString()
  const resolved = await staff.feedbackCases.list({ status: "resolved" })
  expect(resolved).toMatchObject({ total: 1, counts: { new: 0, contacted: 0, resolved: 1 } })
  expect(resolved.items).toMatchObject([{ id, name: "Amel Ben Salah", nps: 3 }])
  expect((await staff.feedbackCases.list({ status: "new" })).items).toHaveLength(0)
})

test("the case list continues after its cursor", async () => {
  const { hotelId, staff, guestId, id } = await unhappy("cases-cursor")
  const [response] = await app.services.db
    .insert(surveyResponses)
    .values({ hotelId, guestId, inviteId: crypto.randomUUID(), nps: 2, language: "fr" })
    .returning()
  const [newer] = await app.services.db.insert(feedbackCases).values({ hotelId, responseId: response!.id }).returning()

  const first = await staff.feedbackCases.list({ limit: 1 })
  const second = await staff.feedbackCases.list({ limit: 1, cursor: first.nextCursor! })

  expect([first.items[0]?.id, second.items[0]?.id]).toEqual([newer!.id, id])
  expect(second).toMatchObject({ total: 2, nextCursor: null })
})

test("another hotel cannot list, read or change a case", async () => {
  const mine = await unhappy("cases-mine")
  const other = await unhappy("cases-other")

  expect((await other.manager.feedbackCases.list()).items.map((item) => item.id)).toEqual([other.id])
  await expect(other.manager.feedbackCases.get({ id: mine.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
  await expect(
    other.manager.feedbackCases.update({ id: mine.id, updatedAt: new Date(), notes: "x" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" })
  expect((await stored(mine.id))?.notes).toBeNull()
})

test("a save from a stale page is refused and keeps the colleague's work", async () => {
  const { manager, staff, id } = await unhappy("cases-stale")
  // The first read carries the column default, with microseconds.
  const { updatedAt } = await staff.feedbackCases.get({ id })

  await manager.feedbackCases.update({ id, updatedAt, status: "resolved", notes: "Refunded the night" })
  await expect(staff.feedbackCases.update({ id, updatedAt, status: "new", notes: "" })).rejects.toMatchObject({
    code: "CONFLICT",
  })

  expect(await stored(id)).toMatchObject({ status: "resolved", notes: "Refunded the night" })
})

test("a save racing the guest's delete never writes the note back", async () => {
  const { hotelId, staff, guestId, id } = await unhappy("cases-race")
  const { updatedAt } = await staff.feedbackCases.get({ id })
  let saving: Promise<unknown> | undefined

  await app.services.db.transaction(async (tx) => {
    await eraseFeedbackNotes(tx, hotelId, guestId)
    saving = staff.feedbackCases.update({ id, updatedAt, notes: "too late" }).catch((error) => error)
    await Bun.sleep(500)
    await tx.delete(guests).where(eq(guests.id, guestId))
  })

  expect(await saving).toMatchObject({ code: "NOT_FOUND" })
  expect((await stored(id))?.notes).toBeNull()
})

test("the guest exports carry the notes", async () => {
  const { manager, save, guestId } = await unhappy("cases-export")
  await save(manager, { notes: "Noisy room 12" })

  const expected = [{ status: "new", notes: "Noisy room 12", nps: 3 }]
  expect((await manager.guests.export({ id: guestId })).feedback).toMatchObject(expected)
  expect((await manager.guests.exportAll()).guests[0]?.feedback).toMatchObject(expected)
  const { csv } = await manager.guests.exportCsv({ id: guestId })
  expect(csv).toContain("3/10 new comment: No hot water notes: Noisy room 12")
})

test("deleting a guest, one or all, erases the notes and drops the case from the inbox", async () => {
  const one = await unhappy("cases-delete-one")
  await one.save(one.manager, { notes: "private" })
  await one.manager.guests.remove({ id: one.guestId })
  expect((await stored(one.id))?.notes).toBeNull()
  expect((await one.manager.feedbackCases.list()).total).toBe(0)

  const all = await unhappy("cases-delete-all")
  await all.save(all.manager, { notes: "private" })
  await all.manager.guests.removeAll({ confirmCount: 1 })
  expect((await stored(all.id))?.notes).toBeNull()
})
