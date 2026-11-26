import { afterAll, beforeAll, expect, test } from "bun:test"
import { isDemoRecipient } from "@ritorno/common/demo"
import { MESSAGE_STATUSES } from "@ritorno/common/message"
import { count, isNotNull, sql } from "drizzle-orm"
import {
  captureSpots,
  consentEvents,
  guests,
  messages,
  notes,
  offerRedemptions,
  organization,
  surveyInvites,
  user,
} from "../../schema"
import { createTestDb, type TestDb } from "../../testing"
import { assertSeedable, seedDemo } from "../index"

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.close())

const OPTS = {
  hashPassword: async (p: string) => `hash:${p}`,
  demoPassword: "pw",
  databaseUrl: "postgres://localhost/demo",
}

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
  // The four demo hotels and the two only the platform admin sees.
  expect(first.hotels).toBe(6)
  expect(first.guests).toBeGreaterThan(1000)
  expect(first.events).toBeGreaterThan(first.guests!)
  expect(first.redemptions).toBeGreaterThan(50)

  expect(await seedDemo(db, OPTS)).toBe(false)
  expect(await totals()).toEqual(first)
  // Two full seeds of some 40k rows: slower than the default 5s on a busy machine.
}, 60_000)

test("every seeded guest and account is unreachable", async () => {
  const people = await testDb.db.select({ phone: guests.phoneE164, email: guests.email }).from(guests)
  const accounts = await testDb.db.select({ email: user.email }).from(user)
  const addresses = [
    ...people.flatMap((g) => (g.email ? [g.phone, g.email] : [g.phone])),
    ...accounts.map((a) => a.email),
  ]
  expect(addresses.filter((to) => !isDemoRecipient(to))).toEqual([])
})

test("the log has every status, previews for unsent messages, and surveys the job would not redo", async () => {
  const rows = await testDb.db
    .select({ status: messages.status, n: count(messages.preview) })
    .from(messages)
    .groupBy(messages.status)
  expect(rows.map((r) => r.status).sort()).toEqual([...MESSAGE_STATUSES].sort())
  expect(rows.find((r) => r.status === "sent")!.n).toBeGreaterThan(0)
  const [unsent] = await testDb.db
    .select({ n: count() })
    .from(surveyInvites)
    .where(sql`${surveyInvites.sentAt} is null`)
  expect(unsent?.n).toBe(0)
})

test("every room and table a guest was captured at is a saved spot of that hotel", async () => {
  const spots = await testDb.db.select().from(captureSpots)
  const saved = new Set(spots.map((s) => `${s.hotelId} ${s.source} ${s.name}`))
  const captured = await testDb.db
    .select({ hotelId: guests.hotelId, source: guests.source, name: guests.captureLocation })
    .from(guests)
    .where(isNotNull(guests.captureLocation))
  expect(captured.length).toBeGreaterThan(0)
  expect(captured.filter((g) => !saved.has(`${g.hotelId} ${g.source.replace("qr_", "")} ${g.name}`))).toEqual([])
})

test("production and remote databases are refused", async () => {
  await expect(seedDemo(testDb.db, { ...OPTS, deployEnv: "production" })).rejects.toThrow("production")
  expect(() => assertSeedable({ databaseUrl: "postgres://u:p@db.example.com:5432/x" })).toThrow("remote")
  expect(() => assertSeedable({ deployEnv: "staging", databaseUrl: "postgres://u:p@postgres:5432/x" })).not.toThrow()
})
