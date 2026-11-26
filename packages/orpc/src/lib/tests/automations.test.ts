import { afterAll, beforeAll, expect, test } from "bun:test"
import { messages } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"
import { claimAndSend, SEND_PACING } from "../automations"
import { isRetryableSendError } from "../messages"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const NO_WAIT = { ...SEND_PACING, pauseMs: 0, retryDelayMs: 0 }

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
  const keys: (string | undefined)[] = []
  const notification = {
    live: true,
    channels: [],
    sendEmail: async (input: SendEmailInput) => {
      const failure = failures[keys.length]
      keys.push(input.idempotencyKey)
      if (failure) throw failure
      return { channel: "email", sent: true, id: "provider-id" }
    },
  }
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  return { services, keys, calls: () => keys.length }
}

const welcome = (hotelId: string, guestId: string) =>
  ({ hotelId, guestId, channel: "email", template: "welcome", props: {} }) as const

test("an email 5xx or lost answer is retried under one idempotency key, and the claim still stops a second send", async () => {
  const { hotelId, guestId } = await guestWithEmail("retry-transient")
  const { services, keys, calls } = provider([
    Object.assign(new Error("down"), { status: 503 }),
    { code: "ECONNRESET" },
  ])

  expect(await claimAndSend(services, { kind: "welcome" }, welcome(hotelId, guestId), NO_WAIT)).toBe(true)
  expect(await claimAndSend(services, { kind: "welcome" }, welcome(hotelId, guestId), NO_WAIT)).toBe(false)

  expect(calls()).toBe(3)
  expect(new Set(keys).size).toBe(1)
  expect(keys[0]).toStartWith("automation-send:")
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

test("without an idempotency key only a 429 or a connect error is retried, never a 5xx or a lost answer", () => {
  const retried = [{ status: 429 }, { code: "ECONNREFUSED" }, { cause: { code: "ENOTFOUND" } }]
  const notRetried = [{ httpStatus: 503 }, { code: "ETIMEDOUT" }, { code: "ECONNRESET" }, { status: 400 }]

  expect(retried.map((error) => isRetryableSendError(error, false))).toEqual([true, true, true])
  expect(notRetried.map((error) => isRetryableSendError(error, false))).toEqual([false, false, false, false])
})
