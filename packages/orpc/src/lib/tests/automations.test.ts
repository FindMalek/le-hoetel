import { afterAll, beforeAll, expect, test } from "bun:test"
import { messages } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"
import { claimAndSend } from "../automations"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const NO_WAIT = { pauseMs: 0, retryDelayMs: 0 }

async function guestWithEmail(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620333333",
    language: "fr",
    email: "amel@example.test",
    source: "staff",
    consents: { email: true, whatsapp: false, profile: false },
  })
  return { hotelId, guestId: guest.id }
}

function provider(failures: unknown[]) {
  let calls = 0
  const notification = {
    live: true,
    channels: [],
    sendEmail: async () => {
      const failure = failures[calls++]
      if (failure) throw failure
      return { channel: "email", sent: true, id: "provider-id" }
    },
  }
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  return { services, calls: () => calls }
}

const welcome = (hotelId: string, guestId: string) =>
  ({ hotelId, guestId, channel: "email", template: "welcome", props: {} }) as const

test("a 5xx or network failure is retried until it goes through, and the claim still stops a second send", async () => {
  const { hotelId, guestId } = await guestWithEmail("retry-transient")
  const { services, calls } = provider([Object.assign(new Error("down"), { status: 503 }), { code: "ECONNRESET" }])

  expect(await claimAndSend(services, { kind: "welcome" }, welcome(hotelId, guestId), NO_WAIT)).toBe(true)
  expect(await claimAndSend(services, { kind: "welcome" }, welcome(hotelId, guestId), NO_WAIT)).toBe(false)

  expect(calls()).toBe(3)
  const rows = await app.services.db.select().from(messages).where(eq(messages.guestId, guestId))
  expect(rows.map((row) => row.status).sort()).toEqual(["failed", "failed", "sent"])
})

test("a permanent provider failure is not retried", async () => {
  const { hotelId, guestId } = await guestWithEmail("retry-permanent")
  const { services, calls } = provider([Object.assign(new Error("bad address"), { status: 422 })])

  await claimAndSend(services, { kind: "welcome" }, welcome(hotelId, guestId), NO_WAIT)

  expect(calls()).toBe(1)
  const rows = await app.services.db.select().from(messages).where(eq(messages.guestId, guestId))
  expect(rows).toMatchObject([{ status: "failed" }])
})
