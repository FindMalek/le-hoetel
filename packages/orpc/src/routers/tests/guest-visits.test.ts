import { afterAll, beforeAll, expect, test } from "bun:test"
import { surveyResponses } from "@ritorno/db"
import { createTestApp, type TestApp } from "../../testing"

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
    source: "qr_room",
    consents: { email: false, whatsapp: true, profile: false },
  }) as const

const nextDay = () => {
  const from = app.services.now()
  app.services.now = () => new Date(from.getTime() + 86_400_000)
}

async function hotelAs(slug: string) {
  const owner = await app.signUp(`${slug}-owner@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  return { hotelId, ...(await app.joinHotel(owner, hotelId, "owner")) }
}

test("a new guest has a first visit, staff add more, and another hotel never finds them", async () => {
  const { client } = await hotelAs("visits-a")
  const other = await hotelAs("visits-b")
  const created = await client.guests.create(guest("+21620555111", "Salma Trabelsi"))

  const [first] = await client.guests.find({ q: "20555" })
  expect(first).toMatchObject({ id: created.id, visits: 1, consents: { whatsapp: true } })

  nextDay()
  const again = await client.guests.markVisit({ id: created.id })
  expect(again.visits).toBe(2)
  expect(await client.guests.find({ q: "salma" })).toHaveLength(1)

  expect(await other.client.guests.find({ q: "salma" })).toEqual([])
  await expect(other.client.guests.markVisit({ id: created.id })).rejects.toThrow()
})

test("the list finds a spaced phone, counts visits and filters returning guests", async () => {
  const { client } = await hotelAs("visits-list")
  const back = await client.guests.create(guest("+21620555222", "Back Again"))
  await client.guests.create(guest("+21620555333", "Only Once"))
  nextDay()
  await client.guests.markVisit({ id: back.id })

  const { items } = await client.guests.list({ q: "20 555 222" })
  expect(items.map((item) => [item.name, item.visits])).toEqual([["Back Again", 2]])
  expect((await client.guests.list({ returning: true })).items.map((item) => item.name)).toEqual(["Back Again"])
})

test("activity lists the guest's stays and survey answers, never to another hotel", async () => {
  const { client, hotelId } = await hotelAs("activity-a")
  const other = await hotelAs("activity-b")
  const created = await client.guests.create(guest("+21620555444", "Rim Saidi"))
  nextDay()
  await client.guests.markVisit({ id: created.id })
  await app.services.db
    .insert(surveyResponses)
    .values({ hotelId, guestId: created.id, inviteId: crypto.randomUUID(), nps: 9, comment: "Lovely", language: "fr" })

  const activity = await client.guests.activity({ id: created.id })
  expect(activity.stays).toHaveLength(2)
  expect(activity.surveys).toMatchObject([{ nps: 9, comment: "Lovely" }])
  await expect(other.client.guests.activity({ id: created.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
})

test("a rescan counts once per hotel day and answers the public like a new phone", async () => {
  const { client } = await hotelAs("rescan")
  // 23:30 UTC is already the next day in Africa/Tunis (UTC+1), the default hotel timezone
  const at = (iso: string) => {
    app.services.now = () => new Date(iso)
  }
  const scan = () =>
    app.anonymous.public.capture({
      slug: "rescan",
      source: "room",
      name: "Hedi",
      phone: "+21620555555",
      language: "fr",
      consents: { email: false, whatsapp: true },
    })
  const visits = async () => (await client.guests.find({ q: "20555555" }))[0]?.visits

  at("2026-03-01T10:00:00Z")
  const first = await scan()
  at("2026-03-01T22:00:00Z")
  expect(await scan()).toEqual(first)
  expect(await visits()).toBe(1)

  at("2026-03-01T23:30:00Z")
  await Promise.all([scan(), scan()])
  expect(await visits()).toBe(2)
})

test("a staff tap is counted once a day and can be undone shortly after, only by its hotel", async () => {
  const { client } = await hotelAs("undo-a")
  const other = await hotelAs("undo-b")
  app.services.now = () => new Date("2026-04-01T10:00:00Z")
  const { id } = await client.guests.create(guest("+21620555666", "Nour"))
  expect((await client.guests.markVisit({ id })).visitId).toBeNull()

  nextDay()
  const { visitId, visits } = await client.guests.markVisit({ id })
  expect(visits).toBe(2)
  await expect(other.client.guests.undoVisit({ id, visitId: visitId! })).rejects.toMatchObject({ code: "NOT_FOUND" })
  await client.guests.undoVisit({ id, visitId: visitId! })
  const again = await client.guests.markVisit({ id })
  expect(again.visits).toBe(2)

  const late = app.services.now().getTime() + 11 * 60_000
  app.services.now = () => new Date(late)
  await expect(client.guests.undoVisit({ id, visitId: again.visitId! })).rejects.toMatchObject({ code: "NOT_FOUND" })
})

test("staff adding a known phone counts the visit and says what changed and what was kept", async () => {
  const { client } = await hotelAs("known")
  app.services.now = () => new Date("2026-05-01T10:00:00Z")
  await client.guests.create(guest("+21620555777", "Ines Ben Ali"))

  nextDay()
  const merged = await client.guests.create({
    ...guest("+21620555777", "Ines B."),
    language: "ar",
    email: "ines@example.com",
    source: "staff",
    consents: { email: true, whatsapp: false, profile: false },
  })
  expect(merged).toMatchObject({
    merged: true,
    name: "Ines Ben Ali",
    changed: ["language", "email", "emailConsent"],
    kept: ["name"],
    visitRecorded: true,
  })
})
