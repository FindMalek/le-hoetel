import { afterAll, beforeAll, expect, test } from "bun:test"
import { auditLog } from "@ritorno/db"
import { eq, sql } from "drizzle-orm"
import { hashGuestId } from "../lib/guests"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const guest = (phone: string, name: string) =>
  ({
    name,
    phone,
    language: "fr",
    email: `${name.toLowerCase()}@example.test`,
    source: "qr_room",
    consents: { email: true, whatsapp: true, profile: false },
  }) as const

async function hotel(slug: string) {
  const owner = await app.signUp(`${slug}-${crypto.randomUUID().slice(0, 6)}@ritorno.test`)
  const hotelId = await app.createHotel(`${slug}-${crypto.randomUUID().slice(0, 6)}`, owner)
  return { hotelId, ...(await app.joinHotel(owner, hotelId, "owner")) }
}

/** Every table of the database that still mentions `needle` anywhere in a row. */
async function tablesMentioning(needle: string): Promise<string[]> {
  const tables = await app.services.db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
  )
  const found: string[] = []
  for (const { table_name } of tables) {
    const hit = await app.services.db.execute(
      sql`select 1 from ${sql.identifier(table_name)} t where t::text ilike ${`%${needle}%`} limit 1`,
    )
    if (hit.length) found.push(table_name)
  }
  return found
}

test("deleting a guest leaves no trace of them in any table, the audit row has no PII, others are untouched", async () => {
  const a = await hotel("del-a")
  const b = await hotel("del-b")
  const victim = await a.client.guests.create(guest("+21620777001", "Zohra"))
  const keep = await a.client.guests.create(guest("+21620777002", "Karim"))
  const other = await b.client.guests.create(guest("+21620777003", "Yasmine"))
  await a.client.guests.setConsent({ guestId: victim.id, channel: "whatsapp", granted: false, source: "stop_reply" })
  await a.client.guests.export({ id: victim.id })
  expect(await tablesMentioning("Zohra")).toContain("guests")

  await a.client.guests.remove({ id: victim.id })

  expect(await tablesMentioning("Zohra")).toEqual([])
  expect(await tablesMentioning("20777001")).toEqual([])
  expect(await tablesMentioning("zohra@example.test")).toEqual([])
  // earlier audit rows (export, consent) keep the opaque id, which names nobody once the guest is gone
  expect(await tablesMentioning(victim.id)).toEqual(["audit_log"])
  expect((await b.client.guests.get({ id: other.id })).name).toBe("Yasmine")
  expect((await b.client.guests.consentHistory({ id: other.id })).length).toBeGreaterThan(0)
  await expect(a.client.guests.get({ id: keep.id })).resolves.toMatchObject({ name: "Karim" })

  const [entry] = await app.services.db.select().from(auditLog).where(eq(auditLog.action, "guest.delete"))
  expect(entry?.targetId).toBe(hashGuestId(victim.id))
  expect(JSON.stringify(entry)).not.toContain(victim.id)
})

test("delete all removes only this hotel's guests with their consent log, and needs the right count", async () => {
  const a = await hotel("all-a")
  const b = await hotel("all-b")
  await a.client.guests.create(guest("+21620888001", "Amina"))
  await a.client.guests.create(guest("+21620888002", "Slim"))
  const survivor = await b.client.guests.create(guest("+21620888003", "Nour"))

  await expect(a.client.guests.removeAll({ confirmCount: 1 })).rejects.toMatchObject({ code: "CONFLICT" })
  expect((await a.client.guests.list({})).total).toBe(2)

  expect(await a.client.guests.removeAll({ confirmCount: 2 })).toEqual({ deleted: 2 })
  expect((await a.client.guests.list({})).total).toBe(0)
  expect(await tablesMentioning("Amina")).toEqual([])
  expect(await tablesMentioning("20888002")).toEqual([])
  expect((await b.client.guests.get({ id: survivor.id })).name).toBe("Nour")
  expect((await b.client.guests.consentHistory({ id: survivor.id })).length).toBeGreaterThan(0)
})

test("only owners and managers can export or delete guests, staff cannot", async () => {
  const a = await hotel("roles")
  const created = await a.client.guests.create(guest("+21620999001", "Rim"))
  const manager = await app.joinHotel(
    await app.signUp(`mgr-${crypto.randomUUID().slice(0, 6)}@ritorno.test`),
    a.hotelId,
    "manager",
  )
  const staff = await app.joinHotel(
    await app.signUp(`stf-${crypto.randomUUID().slice(0, 6)}@ritorno.test`),
    a.hotelId,
    "staff",
  )

  for (const call of [
    () => staff.client.guests.exportCsv({}),
    () => staff.client.guests.exportAll(),
    () => staff.client.guests.export({ id: created.id }),
    () => staff.client.guests.remove({ id: created.id }),
    () => staff.client.guests.removeAll({ confirmCount: 1 }),
  ]) {
    await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" })
  }
  const csv = await manager.client.guests.exportCsv({})
  expect(csv.csv).toContain("+21620999001")
  expect((await a.client.guests.list({})).total).toBe(1)
})

test("csv export holds only this hotel's guests, and one guest by id", async () => {
  const a = await hotel("csv-a")
  const b = await hotel("csv-b")
  const mine = await a.client.guests.create(guest("+21620666001", "Lamia"))
  const theirs = await b.client.guests.create(guest("+21620666002", "Omar"))

  const all = await a.client.guests.exportCsv({})
  expect(all.csv).toContain("Lamia")
  expect(all.csv).not.toContain("Omar")
  expect(all.csv).not.toContain("20666002")
  expect((await a.client.guests.exportCsv({ id: mine.id })).csv.trim().split("\r\n")).toHaveLength(2)
  await expect(a.client.guests.exportCsv({ id: theirs.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
})
