import { afterAll, beforeAll, expect, test } from "bun:test"
import { createTestApp, type TestApp } from "../testing"

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
  return app.joinHotel(owner, hotelId, "owner")
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
