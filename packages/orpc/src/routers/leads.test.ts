import { afterAll, beforeAll, expect, test } from "bun:test"
import { leads } from "@le-hoetel/db"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const request = {
  name: "Sami Trabelsi",
  hotel: "Dar Zitouna",
  phone: "98 123 456",
  city: "Hammamet",
  language: "fr",
} as const

test("a demo request is stored with a clean phone number, a bot's honeypot stores nothing, the sixth try in a row is refused", async () => {
  const headers = new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": "203.0.113.9" })
  const anonymous = app.clientFor(headers)

  await anonymous.leads.request(request)
  await anonymous.leads.request({ ...request, hotel: "Spam Inn", website: "https://spam.test" })
  const rows = await app.services.db.select().from(leads)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ hotelName: "Dar Zitouna", phone: "+21698123456", language: "fr" })

  for (let i = 0; i < 3; i++) await anonymous.leads.request(request)
  await expect(anonymous.leads.request(request)).rejects.toThrow()
})
