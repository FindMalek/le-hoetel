import { afterAll, beforeAll, expect, test } from "bun:test"
import { invalidField } from "@ritorno/common/field-errors"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const refusedField = (call: Promise<unknown>) => call.then(() => null, invalidField)

test("a refused sign-up names the field, and staff find a number typed the local way", async () => {
  const owner = await app.signUp("phone-fields@ritorno.test")
  const hotelId = await app.createHotel("phone-fields", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  const scan = {
    slug: "phone-fields",
    name: "Camille Roy",
    phone: "+33 6 12 34 56 78",
    language: "fr",
    source: "desk",
    consents: { email: false, whatsapp: true },
  } as const

  expect(await refusedField(app.anonymous.public.capture({ ...scan, phone: "+999 1" }))).toBe("phone")
  // a landline passes the input schema and is refused by the handler's own check
  expect(await refusedField(app.anonymous.public.capture({ ...scan, phone: "71 123 456" }))).toBe("consents.whatsapp")

  await app.anonymous.public.capture(scan)
  const found = await client.guests.find({ q: "06 12 34 56 78" })
  expect(found.map((guest) => guest.phoneE164)).toEqual(["+33612345678"])
})
