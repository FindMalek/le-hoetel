import { afterAll, beforeAll, expect, test } from "bun:test"
import { messages } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"
import { HOLIDAY_JOB } from "../holidays"
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

async function hotel(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const add = (phone: string, consents: { email: boolean; whatsapp: boolean }) =>
    client.guests
      .create({
        name: "Amel",
        phone,
        language: "ar",
        email: `${phone.slice(1)}@example.test`,
        source: "staff",
        consents: { ...consents, profile: false },
      })
      .then((guest) => guest.id)
  return { hotelId, client, add }
}

const runAt = (iso: string, batchSize?: number) => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const job = createMessageJobs(services, { pauseMs: 0, batchSize }).find(
    (candidate) => candidate.name === HOLIDAY_JOB,
  )!
  return job.run({}, { db: app.services.db, now: () => new Date(iso), jobId: "t" })
}

const rowsFor = (guestId: string) => app.services.db.select().from(messages).where(eq(messages.guestId, guestId))

test("a switched on holiday greets consented guests on the chosen channel, once, from 09:00 hotel time", async () => {
  const { client, add } = await hotel("holiday-on")
  const emailGuest = await add("+21620700001", { email: true, whatsapp: false })
  const whatsappGuest = await add("+21620700002", { email: false, whatsapp: true })
  const nobody = await add("+21620700003", { email: false, whatsapp: false })
  await client.holidays.update({ key: "ramadan_start", enabled: true, channel: "email" })
  sent.length = 0

  await runAt("2026-02-18T07:30:00Z")
  expect(sent).toHaveLength(0)

  await runAt("2026-02-18T08:30:00Z")
  await runAt("2026-02-18T09:30:00Z")

  expect(sent).toHaveLength(1)
  expect(sent[0]?.email.subject).toContain("رمضان مبارك")
  expect(await rowsFor(emailGuest)).toMatchObject([{ channel: "email", templateKey: "message", status: "sent" }])
  expect(await rowsFor(whatsappGuest)).toHaveLength(0)
  expect(await rowsFor(nobody)).toHaveLength(0)
})

test("each run sends one batch per hotel and the next run picks up the guests not reached yet", async () => {
  const { client, add } = await hotel("holiday-batch")
  const ids = await Promise.all(
    ["+21620700011", "+21620700012", "+21620700013"].map((phone) => add(phone, { email: true, whatsapp: false })),
  )
  await client.holidays.update({ key: "ramadan_start", enabled: true, channel: "email" })
  const reached = async () => (await Promise.all(ids.map(rowsFor))).filter((rows) => rows.length).length

  await runAt("2026-02-18T10:00:00Z", 2)
  expect(await reached()).toBe(2)

  await runAt("2026-02-18T10:01:00Z", 2)
  expect(await reached()).toBe(3)
})

test("a holiday the hotel did not switch on sends nothing", async () => {
  const { client, add } = await hotel("holiday-off")
  const guest = await add("+21620700004", { email: true, whatsapp: true })
  await client.holidays.update({ key: "republic_day", enabled: false, channel: "both" })

  await runAt("2026-07-25T09:00:00Z")

  expect(await rowsFor(guest)).toHaveLength(0)
})

test("two holidays on one day send a guest only the first greeting", async () => {
  const { client, add } = await hotel("holiday-two")
  const guest = await add("+21620700005", { email: true, whatsapp: false })
  await client.holidays.update({ key: "eid_al_fitr", enabled: true, channel: "both" })
  await client.holidays.update({ key: "independence_day", enabled: true, channel: "both" })

  await runAt("2026-03-20T09:00:00Z")

  expect(await rowsFor(guest)).toHaveLength(1)
})

test("the dashboard list shows every holiday with its next date and what the hotel chose", async () => {
  const { client } = await hotel("holiday-list")
  await client.holidays.update({ key: "mawlid", enabled: true, channel: "whatsapp" })

  const list = await client.holidays.list()

  expect(list).toHaveLength(7)
  expect(list.find((row) => row.key === "mawlid")).toMatchObject({ enabled: true, channel: "whatsapp" })
  expect(list.find((row) => row.key === "new_year")).toMatchObject({ enabled: false, channel: "both" })
})
