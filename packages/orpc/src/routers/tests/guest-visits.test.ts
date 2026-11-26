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
  await client.guests.markVisit({ id: back.id })

  const { items } = await client.guests.list({ q: "20 555 222" })
  expect(items.map((item) => [item.name, item.visits])).toEqual([["Back Again", 2]])
  expect((await client.guests.list({ returning: true })).items.map((item) => item.name)).toEqual(["Back Again"])
})

test("activity lists the guest's stays and survey answers, never to another hotel", async () => {
  const { client, hotelId } = await hotelAs("activity-a")
  const other = await hotelAs("activity-b")
  const created = await client.guests.create(guest("+21620555444", "Rim Saidi"))
  await client.guests.markVisit({ id: created.id })
  await app.services.db
    .insert(surveyResponses)
    .values({ hotelId, guestId: created.id, inviteId: crypto.randomUUID(), nps: 9, comment: "Lovely", language: "fr" })

  const activity = await client.guests.activity({ id: created.id })
  expect(activity.stays).toHaveLength(2)
  expect(activity.surveys).toMatchObject([{ nps: 9, comment: "Lovely" }])
  await expect(other.client.guests.activity({ id: created.id })).rejects.toMatchObject({ code: "NOT_FOUND" })
})
