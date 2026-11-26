import { afterAll, beforeAll, expect, test } from "bun:test"
import { automationSends, hotelSettings, messages } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"
import { createMessageJobs } from "../index"
import { WELCOME_JOB } from "../welcome"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const sent: SendEmailInput[] = []
const queued: { name: string; payload: unknown }[] = []
const notification = {
  live: false,
  channels: [],
  sendEmail: async (input: SendEmailInput) => {
    sent.push(input)
    return { channel: "email", sent: false }
  },
}

async function hotel(slug: string, consents: { email: boolean; whatsapp: boolean }) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const guest = await client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620333333",
    language: "fr",
    email: "amel@example.test",
    source: "staff",
    consents: { ...consents, profile: false },
  })
  return { hotelId, guestId: guest.id, client }
}

const welcome = () => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const job = createMessageJobs(services).find((candidate) => candidate.name === WELCOME_JOB)!
  return (hotelId: string, guestId: string) =>
    job.run({ hotelId, guestId }, { db: app.services.db, now: () => new Date(), jobId: "t" })
}

test("the welcome goes out once on each consented channel, however often the job runs", async () => {
  const { hotelId, guestId } = await hotel("welcome-once", { email: true, whatsapp: false })
  const run = welcome()
  sent.length = 0

  await run(hotelId, guestId)
  await run(hotelId, guestId)

  expect(sent).toHaveLength(1)
  const rows = await app.services.db.select().from(messages).where(eq(messages.guestId, guestId))
  expect(rows).toMatchObject([{ channel: "email", templateKey: "welcome", status: "sent" }])
  expect(await app.services.db.select().from(automationSends).where(eq(automationSends.guestId, guestId))).toHaveLength(
    1,
  )
})

test("a guest without consent gets nothing, not even a skipped row", async () => {
  const { hotelId, guestId } = await hotel("welcome-none", { email: false, whatsapp: false })

  await welcome()(hotelId, guestId)

  expect(await app.services.db.select().from(messages).where(eq(messages.guestId, guestId))).toHaveLength(0)
})

test("adding a guest with consent queues the welcome job, without consent or by csv import it does not", async () => {
  queued.length = 0
  const jobs = {
    enqueue: async (name: string, payload: unknown) => {
      queued.push({ name, payload })
      return { ok: true as const, id: "1" }
    },
    list: async () => [],
  }
  const owner = await app.signUp("welcome-queue@ritorno.test")
  const hotelId = await app.createHotel("welcome-queue", owner)
  const { headers } = await app.joinHotel(owner, hotelId, "owner")
  const { createRouterClient } = await import("@orpc/server")
  const { createContext } = await import("../../context")
  const { appRouter } = await import("../../routers")
  const client = createRouterClient(appRouter, { context: () => createContext({ ...app.services, jobs }, headers) })
  const base = { name: "Sami", language: "en" as const, source: "staff" as const }

  await client.guests.create({
    ...base,
    phone: "+21620444444",
    consents: { email: false, whatsapp: false, profile: false },
  })
  await client.guests.create({
    ...base,
    phone: "+21620555555",
    consents: { email: false, whatsapp: true, profile: false },
  })
  await client.guests.import({
    rows: [{ line: 2, name: "Old list", phone: "20 666 666", email: "old@example.test", consent: "yes" }],
    defaultLanguage: "fr",
    confirmConsent: true,
  })

  expect(queued).toMatchObject([{ name: WELCOME_JOB, payload: { hotelId } }])
})

test("the welcome carries the hotel's active welcome offer with the guest's own code", async () => {
  const { hotelId, guestId, client } = await hotel("welcome-offer", { email: true, whatsapp: false })
  await client.offers.create({ title: "Free mint tea", promoCode: "TEA10", trigger: "welcome" })
  await client.offers.create({ title: "Old news", promoCode: "OLD10", trigger: "welcome", active: false })
  sent.length = 0

  await welcome()(hotelId, guestId)

  expect(sent[0]?.email.html).toContain("Free mint tea")
  expect(sent[0]?.email.html).not.toContain("Old news")
})

test("a suspended hotel sends no welcome", async () => {
  const { hotelId, guestId } = await hotel("welcome-suspended", { email: true, whatsapp: false })
  await app.services.db
    .update(hotelSettings)
    .set({ status: "suspended" })
    .where(eq(hotelSettings.organizationId, hotelId))
  sent.length = 0

  await welcome()(hotelId, guestId)

  expect(sent).toHaveLength(0)
})

async function publicForm(slug: string, onQueue: (payload: { hotelId: string; guestId: string }) => Promise<void>) {
  const hotelId = await app.createHotel(slug, await app.signUp(`${slug}@ritorno.test`))
  const jobs = {
    enqueue: async (_name: string, payload: unknown) => {
      await onQueue(payload as { hotelId: string; guestId: string })
      return { ok: true as const, id: "1" }
    },
    list: async () => [],
  }
  const { createRouterClient } = await import("@orpc/server")
  const { createContext } = await import("../../context")
  const { appRouter } = await import("../../routers")
  let ip = 0
  const capture = (input: { phone: string; email?: string; consents: { email: boolean; whatsapp: boolean } }) => {
    const headers = new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": `10.9.${ip >> 8}.${ip++ & 255}` })
    const client = createRouterClient(appRouter, { context: () => createContext({ ...app.services, jobs }, headers) })
    return client.public.capture({
      slug,
      renderedAt: Date.now() - 3_600_000,
      name: "Amel Ben Salah",
      language: "fr",
      source: "room",
      ...input,
    })
  }
  return { hotelId, capture }
}

test("a second capture of the same phone within 30 days sends no new welcome", async () => {
  const run = welcome()
  const { hotelId, capture } = await publicForm("welcome-rescan", (payload) => run(payload.hotelId, payload.guestId))
  const phone = "+21620666666"

  await capture({ phone, email: "amel@example.test", consents: { email: true, whatsapp: false } })
  await capture({ phone, email: "amel@example.test", consents: { email: true, whatsapp: true } })

  const rows = await app.services.db.select().from(messages).where(eq(messages.hotelId, hotelId))
  expect(rows.map((row) => row.channel)).toEqual(["email"])
})

test("welcomes from the public form stop at the hourly cap per hotel", async () => {
  let queued = 0
  const { capture } = await publicForm("welcome-cap", async () => {
    queued++
  })
  const { RATE_LIMITS } = await import("../../lib/rate-limit")

  for (let i = 0; i <= RATE_LIMITS.welcomeHotel.limit; i++) {
    await capture({ phone: `+2162077${String(i).padStart(4, "0")}`, consents: { email: false, whatsapp: true } })
  }

  expect(queued).toBe(RATE_LIMITS.welcomeHotel.limit)
})
