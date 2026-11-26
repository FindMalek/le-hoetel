import { afterAll, beforeAll, expect, test } from "bun:test"
import { messages } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"
import { BIRTHDAY_JOB } from "../birthday"
import { createMessageJobs } from "../index"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const sent: SendEmailInput[] = []
const notification = {
  live: false,
  channels: [],
  sendEmail: async (input: SendEmailInput) => {
    sent.push(input)
    return { channel: "email", sent: false }
  },
}

async function hotel(slug: string, options: { birthday: string; email?: boolean; offer?: boolean }) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620666666",
    language: "fr",
    email: "amel@example.test",
    birthday: options.birthday,
    source: "staff",
    consents: { email: options.email ?? true, whatsapp: false, profile: false },
  })
  if (options.offer !== false) {
    await client.offers.create({ title: "Birthday dessert", promoCode: "BDAY", trigger: "birthday" })
  }
  return { hotelId, guestId: guest.id }
}

const runAt = (iso: string) => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const job = createMessageJobs(services).find((candidate) => candidate.name === BIRTHDAY_JOB)!
  return job.run({}, { db: app.services.db, now: () => new Date(iso), jobId: "t" })
}

const countFor = async (guestId: string) =>
  (await app.services.db.select().from(messages).where(eq(messages.guestId, guestId))).length

test("the birthday offer goes out from 09:00 hotel time, once a year however often the job runs", async () => {
  const { guestId } = await hotel("bday-once", { birthday: "1990-05-17" })

  await runAt("2026-05-17T07:30:00Z")
  expect(await countFor(guestId)).toBe(0)

  await runAt("2026-05-17T08:05:00Z")
  await runAt("2026-05-17T09:05:00Z")
  expect(await countFor(guestId)).toBe(1)

  await runAt("2027-05-17T08:05:00Z")
  expect(await countFor(guestId)).toBe(2)
})

test("a guest without consent, or a hotel without a birthday offer, gets nothing", async () => {
  const noConsent = await hotel("bday-no-consent", { birthday: "1990-05-18", email: false })
  const noOffer = await hotel("bday-no-offer", { birthday: "1990-05-18", offer: false })

  await runAt("2026-05-18T09:00:00Z")

  expect(await countFor(noConsent.guestId)).toBe(0)
  expect(await countFor(noOffer.guestId)).toBe(0)
})

test("someone born on 29 February is celebrated on the 28th in a year without one", async () => {
  const { guestId } = await hotel("bday-leap", { birthday: "1992-02-29" })

  await runAt("2027-02-28T09:00:00Z")

  expect(await countFor(guestId)).toBe(1)
})
