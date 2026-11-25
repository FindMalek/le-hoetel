import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Notifier } from "@ritorno/notification"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("a hotel previews its own branding and test sends only go to the signed in user, a few at a time", async () => {
  const owner = await app.signUp("emails-owner@ritorno.test")
  const hotelId = await app.createHotel("emails-a", owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  await client.hotel.update({ primaryColor: "#0f766e" })

  const preview = await client.emails.preview({ template: "welcome", locale: "ar" })
  expect(preview.html).toContain('dir="rtl"')
  expect(preview.html).toContain("#0f766e")

  const sent: { to: string; subject: string }[] = []
  app.services.notification = {
    ...app.services.notification,
    sendEmail: async ({ to, email }) => {
      sent.push({ to, subject: email.subject })
      return { channel: "email", sent: true }
    },
  } satisfies Notifier
  expect(await client.emails.sendTest({ template: "birthday", locale: "fr" })).toEqual({
    sent: true,
    to: "emails-owner@ritorno.test",
  })
  expect(sent).toHaveLength(1)
  expect(sent[0]?.to).toBe("emails-owner@ritorno.test")
  expect(sent[0]?.subject).toStartWith("[Test] ")

  for (let i = 0; i < 4; i++) await client.emails.sendTest({ template: "survey", locale: "en" })
  await expect(client.emails.sendTest({ template: "survey", locale: "en" })).rejects.toMatchObject({
    code: "TOO_MANY_REQUESTS",
  })
  await expect(app.anonymous.emails.preview({ template: "welcome", locale: "en" })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  })
})
