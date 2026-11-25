import { afterAll, beforeAll, expect, test } from "bun:test"
import { balanceLedger } from "@ritorno/db"
import { eq, sum } from "drizzle-orm"
import { getBalance, topUp } from "../lib/balance"
import { sendToGuest } from "../lib/messages"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

async function hotelWithGuest(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620333333",
    language: "fr",
    email: "amel@example.test",
    source: "qr_room",
    consents: { email: true, whatsapp: true, profile: false },
  })
  return { hotelId, guestId: guest.id, client }
}

const welcome = (hotelId: string, guestId: string, channel: "email" | "whatsapp") =>
  sendToGuest(app.services, { hotelId, guestId, channel, template: "welcome", props: {} })

test("whatsapp is blocked without balance, email stays free, and the ledger sums to the balance", async () => {
  const { hotelId, guestId, client } = await hotelWithGuest("balance-hotel")

  expect((await welcome(hotelId, guestId, "whatsapp")).status).toBe("skipped_no_balance")
  expect((await welcome(hotelId, guestId, "email")).status).toBe("sent")

  await topUp(app.services.db, hotelId, 100)
  expect((await welcome(hotelId, guestId, "whatsapp")).status).toBe("sent")
  expect((await welcome(hotelId, guestId, "whatsapp")).status).toBe("sent")
  expect((await welcome(hotelId, guestId, "whatsapp")).status).toBe("sent")
  expect((await welcome(hotelId, guestId, "whatsapp")).status).toBe("skipped_no_balance")

  const balance = await getBalance(app.services.db, hotelId)
  expect(balance).toBe(100 - 3 * 32)
  const [ledger] = await app.services.db
    .select({ total: sum(balanceLedger.amountMillimes) })
    .from(balanceLedger)
    .where(eq(balanceLedger.hotelId, hotelId))
  expect(Number(ledger?.total)).toBe(balance)

  const view = await client.hotel.balance.get()
  expect(view).toMatchObject({ balanceMillimes: balance, low: true, monthSpentMillimes: 96, monthMessages: 3 })
})

test("a top-up credits only its own hotel and only the app admin can make one", async () => {
  const a = await hotelWithGuest("balance-a")
  const b = await hotelWithGuest("balance-b")
  const admin = await app.signUp("balance-admin@ritorno.test", { role: "admin" })

  await expect(a.client.admin.hotels.balance.topUp({ id: a.hotelId, amountMillimes: 20000 })).rejects.toMatchObject({
    code: "FORBIDDEN",
  })
  await admin.client.admin.hotels.balance.topUp({ id: a.hotelId, amountMillimes: 20000, note: "cash" })

  expect(await a.client.hotel.balance.get()).toMatchObject({ balanceMillimes: 20000, low: false })
  expect(await b.client.hotel.balance.get()).toMatchObject({ balanceMillimes: 0, low: true, entries: [] })
  expect((await welcome(b.hotelId, b.guestId, "whatsapp")).status).toBe("skipped_no_balance")
})
