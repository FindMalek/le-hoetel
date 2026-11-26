import { afterAll, beforeAll, expect, test } from "bun:test"
import { hotelSettings } from "@ritorno/db"
import type { SendEmailInput } from "@ritorno/notification"
import { eq } from "drizzle-orm"
import { notifyManager } from "../../lib/manager-alerts"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("a manager alert is emailed to the owner, or to the reply-to address once one is set", async () => {
  const emails: SendEmailInput[] = []
  const notification = {
    sendEmail: async (input: SendEmailInput) => {
      emails.push(input)
      return { channel: "email", sent: true }
    },
  }
  const ctx = { ...app.services, notification: notification as unknown as typeof app.services.notification }
  const owner = await app.signUp("alerts-owner@ritorno.test")
  const hotelId = await app.createHotel("alerts-email", owner)

  expect(await notifyManager(ctx, hotelId, "low score")).toBe(true)
  await app.services.db
    .update(hotelSettings)
    .set({ replyToEmail: "desk@ritorno.test" })
    .where(eq(hotelSettings.organizationId, hotelId))
  expect(await notifyManager(ctx, hotelId, "low score")).toBe(true)

  expect(emails.map((email) => email.to)).toEqual(["alerts-owner@ritorno.test", "desk@ritorno.test"])
  expect(emails[0]?.email.subject).toContain("low score")
})
