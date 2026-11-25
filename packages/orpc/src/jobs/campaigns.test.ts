import { afterAll, beforeAll, expect, test } from "bun:test"
import { EMPTY_SEGMENT } from "@ritorno/common/campaigns"
import type { SendEmailInput } from "@ritorno/notification"
import { createTestApp, type TestApp } from "../testing"
import { CAMPAIGN_JOB } from "./campaigns"
import { createMessageJobs } from "./index"

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
  let n = 0
  const add = (language: "en" | "fr" | "ar", consents: { email: boolean; whatsapp: boolean }) =>
    client.guests.create({
      name: "Amel",
      phone: `+2162080${String(++n).padStart(4, "0")}`,
      language,
      email: `g${n}-${slug}@example.test`,
      source: "staff",
      consents: { ...consents, profile: false },
    })
  const draft = (segment = EMPTY_SEGMENT, channel: "email" | "both" | "whatsapp" = "email") =>
    client.campaigns.create({
      name: "Ramadan evenings",
      channel,
      content: { fr: { subject: "Iftar au {hotel}", body: "Bonjour {name}, venez dîner." } },
      segment,
      offerId: null,
    })
  return { client, add, draft }
}

const runAt = (iso: string, batchSize = 20) => {
  const services = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const job = createMessageJobs(services, { campaignPauseMs: 0, campaignBatchSize: batchSize }).find(
    (candidate) => candidate.name === CAMPAIGN_JOB,
  )!
  return job.run({}, { db: app.services.db, now: () => new Date(iso), jobId: "t" })
}

test("the audience is the consented guests who match the filters, and the preview counts them", async () => {
  const { client, add, draft } = await hotel("camp-preview")
  await add("fr", { email: true, whatsapp: false })
  await add("fr", { email: false, whatsapp: true })
  await add("ar", { email: true, whatsapp: false })

  expect(await client.campaigns.preview({ channel: "email", segment: EMPTY_SEGMENT })).toMatchObject({
    guests: 2,
    email: 2,
  })
  const french = { ...EMPTY_SEGMENT, languages: ["fr" as const] }
  expect(await client.campaigns.preview({ channel: "both", segment: french })).toMatchObject({
    guests: 2,
    email: 1,
    whatsapp: 1,
  })
  await expect(
    client.campaigns.schedule({ id: (await draft({ ...EMPTY_SEGMENT, languages: ["en"] })).id, at: null }),
  ).rejects.toThrow("No guest matches")
})

test("a campaign goes out in batches, once per guest, and its results come from the message log", async () => {
  const { client, add, draft } = await hotel("camp-batches")
  for (let i = 0; i < 3; i++) await add("fr", { email: true, whatsapp: false })
  const campaign = await draft()
  await client.campaigns.schedule({ id: campaign.id, at: null })
  sent.length = 0

  await runAt("2027-03-01T10:00:00Z", 2)
  expect(sent).toHaveLength(2)
  expect(sent[0]?.email.subject).toContain("Iftar au")

  await runAt("2027-03-01T10:01:00Z", 2)
  await runAt("2027-03-01T10:02:00Z", 2)
  expect(sent).toHaveLength(3)

  const done = await client.campaigns.get({ id: campaign.id })
  expect(done).toMatchObject({ status: "sent", results: { targeted: 3, sent: 3, failed: 0 } })
})

test("nothing is sent in quiet hours, and a cancelled campaign stops", async () => {
  const { client, add, draft } = await hotel("camp-quiet")
  await add("fr", { email: true, whatsapp: false })
  const quiet = await draft()
  const cancelled = await draft()
  await client.campaigns.schedule({ id: quiet.id, at: null })
  await client.campaigns.schedule({ id: cancelled.id, at: null })
  await client.campaigns.cancel({ id: cancelled.id })
  sent.length = 0

  await runAt("2027-03-01T20:30:00Z")
  expect(sent).toHaveLength(0)

  await runAt("2027-03-01T08:30:00Z")
  expect(sent).toHaveLength(1)
  expect(await client.campaigns.get({ id: cancelled.id })).toMatchObject({
    status: "cancelled",
    results: { targeted: 0 },
  })
})

test("another hotel cannot read, change or send a campaign, and a sent one cannot be edited", async () => {
  const mine = await hotel("camp-mine")
  const theirs = await hotel("camp-theirs")
  await mine.add("fr", { email: true, whatsapp: false })
  const campaign = await mine.draft()

  await expect(theirs.client.campaigns.get({ id: campaign.id })).rejects.toThrow("not found")
  await expect(theirs.client.campaigns.schedule({ id: campaign.id, at: null })).rejects.toThrow("not found")

  await mine.client.campaigns.schedule({ id: campaign.id, at: null })
  await expect(mine.client.campaigns.update({ ...campaign, name: "Changed" })).rejects.toThrow("Only a draft")
})
