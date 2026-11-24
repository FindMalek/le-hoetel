import { afterAll, beforeAll, expect, test } from "bun:test"
import { member } from "@le-hoetel/db"
import { and, eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../testing"
import { guestsRouter } from "./guests"

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

async function twoHotels() {
  const ownerA = await app.signUp(`iso-a-${crypto.randomUUID()}@le-hoetel.test`)
  const ownerB = await app.signUp(`iso-b-${crypto.randomUUID()}@le-hoetel.test`)
  const hotelA = await app.createHotel(`iso-a-${crypto.randomUUID().slice(0, 8)}`, ownerA)
  const hotelB = await app.createHotel(`iso-b-${crypto.randomUUID().slice(0, 8)}`, ownerB)
  const a = await app.joinHotel(ownerA, hotelA, "owner")
  const b = await app.joinHotel(ownerB, hotelB, "owner")
  const guestA = await a.client.guests.create(guest("+21620111111", "Alice"))
  const guestB = await b.client.guests.create(guest("+21620222222", "Bob"))
  return { a, b, hotelA, hotelB, guestA, guestB }
}

test("a hotel can't read, change, export or delete another hotel's guest, even knowing the id", async () => {
  const { a, b, guestB } = await twoHotels()
  const before = await b.client.guests.export({ id: guestB.id })

  const attempts = {
    get: () => a.client.guests.get({ id: guestB.id }),
    update: () => a.client.guests.update({ id: guestB.id, name: "Hacked" }),
    setConsent: () =>
      a.client.guests.setConsent({ guestId: guestB.id, channel: "whatsapp", granted: false, source: "staff" }),
    consentHistory: () => a.client.guests.consentHistory({ id: guestB.id }),
    export: () => a.client.guests.export({ id: guestB.id }),
    remove: () => a.client.guests.remove({ id: guestB.id }),
  }
  for (const [name, attempt] of Object.entries(attempts)) {
    await expect(attempt(), name).rejects.toMatchObject({ code: "NOT_FOUND" })
  }

  const after = await b.client.guests.export({ id: guestB.id })
  expect({ ...after, exportedAt: null }).toEqual({ ...before, exportedAt: null })
})

test("lists, search and the hotel export only hold the caller's own guests", async () => {
  const { a, guestA, guestB } = await twoHotels()
  expect((await a.client.guests.list({})).items.map((item) => item.id)).toEqual([guestA.id])
  expect((await a.client.guests.list({ q: "Bob" })).total).toBe(0)
  expect((await a.client.guests.list({ q: "20222222" })).total).toBe(0)

  const everything = await a.client.guests.exportAll()
  expect(everything.guests.map((entry) => entry.guest.id)).toEqual([guestA.id])
  expect(JSON.stringify(everything)).not.toContain(guestB.phoneE164)
})

test("the hotel header can't aim at another hotel, only the app admin may", async () => {
  const { a, hotelA, hotelB, guestB } = await twoHotels()
  const withHeader = (headers: Headers, hotelId: string) => {
    const copy = new Headers(headers)
    copy.set("x-hotel-id", hotelId)
    return app.clientFor(copy)
  }
  await expect(withHeader(a.headers, hotelB).guests.list({})).rejects.toMatchObject({ code: "FORBIDDEN" })
  await expect(withHeader(a.headers, hotelA).guests.list({})).resolves.toMatchObject({ total: 1 })

  const admin = await app.signUp(`iso-admin-${crypto.randomUUID()}@le-hoetel.test`, { role: "admin" })
  await expect(admin.client.guests.list({})).rejects.toMatchObject({ code: "FORBIDDEN" })
  const seen = await withHeader(admin.headers, hotelB).guests.list({})
  expect(seen.items.map((item) => item.id)).toEqual([guestB.id])
  await expect(withHeader(admin.headers, "no-such-hotel").guests.list({})).rejects.toMatchObject({ code: "NOT_FOUND" })
})

test("membership is checked on every call: a removed member or a user without a hotel gets nothing", async () => {
  const { a, hotelA } = await twoHotels()
  const staff = await app.signUp(`iso-staff-${crypto.randomUUID()}@le-hoetel.test`)
  const asStaff = await app.joinHotel(staff, hotelA, "staff")
  await expect(asStaff.client.guests.list({})).resolves.toMatchObject({ total: 1 })
  await expect(asStaff.client.guests.exportAll()).rejects.toMatchObject({ code: "FORBIDDEN" })
  await expect(
    asStaff.client.guests.remove({ id: (await a.client.guests.list({})).items[0]!.id }),
  ).rejects.toMatchObject({
    code: "FORBIDDEN",
  })

  await app.services.db.delete(member).where(and(eq(member.userId, staff.id), eq(member.organizationId, hotelA)))
  await expect(asStaff.client.guests.list({})).rejects.toMatchObject({ code: "FORBIDDEN" })

  const nobody = await app.signUp(`iso-nobody-${crypto.randomUUID()}@le-hoetel.test`)
  await expect(nobody.client.guests.list({})).rejects.toMatchObject({ code: "FORBIDDEN" })
})

test("every guest procedure needs a session, and a new one must be added to the isolation tests above", async () => {
  const covered = [
    "list",
    "get",
    "create",
    "update",
    "setConsent",
    "export",
    "exportAll",
    "remove",
    "consentHistory",
    "import",
  ]
  expect(Object.keys(guestsRouter).sort()).toEqual([...covered].sort())
  const calls = {
    list: () => app.anonymous.guests.list({}),
    get: () => app.anonymous.guests.get({ id: crypto.randomUUID() }),
    create: () => app.anonymous.guests.create(guest("+21620333333", "Carl")),
    update: () => app.anonymous.guests.update({ id: crypto.randomUUID() }),
    setConsent: () =>
      app.anonymous.guests.setConsent({
        guestId: crypto.randomUUID(),
        channel: "email",
        granted: false,
        source: "staff",
      }),
    export: () => app.anonymous.guests.export({ id: crypto.randomUUID() }),
    exportAll: () => app.anonymous.guests.exportAll(),
    remove: () => app.anonymous.guests.remove({ id: crypto.randomUUID() }),
    consentHistory: () => app.anonymous.guests.consentHistory({ id: crypto.randomUUID() }),
    import: () =>
      app.anonymous.guests.import({
        rows: [{ line: 2, name: "X", phone: "20111111" }],
        defaultLanguage: "fr",
        confirmConsent: false,
      }),
  }
  for (const [name, call] of Object.entries(calls)) {
    await expect(call(), name).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  }
})
