import { afterAll, beforeAll, expect, test } from "bun:test"
import { count } from "drizzle-orm"
import { consentEvents, guests, notes, offerRedemptions, organization, user } from "../../schema"
import { createTestDb, type TestDb } from "../../testing"
import { seedDemo } from "../index"

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.close())

const OPTS = { hashPassword: async (p: string) => `hash:${p}`, demoPassword: "pw" }

test("seeding twice leaves the first run's data alone", async () => {
  const { db } = testDb
  const totals = async () => ({
    users: (await db.select({ n: count() }).from(user))[0]?.n,
    notes: (await db.select({ n: count() }).from(notes))[0]?.n,
    hotels: (await db.select({ n: count() }).from(organization))[0]?.n,
    guests: (await db.select({ n: count() }).from(guests))[0]?.n,
    events: (await db.select({ n: count() }).from(consentEvents))[0]?.n,
    redemptions: (await db.select({ n: count() }).from(offerRedemptions))[0]?.n,
  })

  expect(await seedDemo(db, OPTS)).toBe(true)
  const first = await totals()
  expect(first.users).toBeGreaterThan(0)
  expect(first.notes).toBeGreaterThan(0)
  expect(first.hotels).toBe(4)
  expect(first.guests).toBeGreaterThan(300)
  expect(first.events).toBeGreaterThan(first.guests!)
  expect(first.redemptions).toBeGreaterThan(50)

  expect(await seedDemo(db, OPTS)).toBe(false)
  expect(await totals()).toEqual(first)
})
