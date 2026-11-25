import { afterAll, beforeAll, expect, test } from "bun:test"
import { hotelSettings } from "@le-hoetel/db"
import type { SendEmailInput } from "@le-hoetel/notification"
import { eq } from "drizzle-orm"
import { linkTelegramChat, notifyManager } from "../lib/manager-alerts"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const telegramTo: string[] = []
const emails: SendEmailInput[] = []
const notification = {
  sendTelegram: async (chatId: string) => {
    telegramTo.push(chatId)
    return { channel: "telegram", sent: true }
  },
  sendEmail: async (input: SendEmailInput) => {
    emails.push(input)
    return { channel: "email", sent: true }
  },
}
const ctx = () => ({ ...app.services, notification: notification as unknown as typeof app.services.notification })

async function hotel(slug: string) {
  const owner = await app.signUp(`${slug}@le-hoetel.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  return { hotelId, client }
}

test("a link code binds one chat to its own hotel, once, and expires", async () => {
  const a = await hotel("alerts-a")
  const b = await hotel("alerts-b")
  const { code, url } = await a.client.hotel.alerts.link()
  expect(url).toBe(`https://t.me/le_hoetel_test_bot?start=${code}`)

  expect(await linkTelegramChat(app.services.db, "wrong", "111", new Date())).toBe(false)
  expect(await linkTelegramChat(app.services.db, code, "111", new Date(Date.now() + 16 * 60 * 1000))).toBe(false)
  expect(await linkTelegramChat(app.services.db, code, "111", new Date())).toBe(true)
  expect(await linkTelegramChat(app.services.db, code, "222", new Date())).toBe(false)

  expect(await a.client.hotel.alerts.status()).toMatchObject({ linked: true })
  expect(await b.client.hotel.alerts.status()).toMatchObject({ linked: false })
  const [row] = await app.services.db.select().from(hotelSettings).where(eq(hotelSettings.organizationId, a.hotelId))
  expect(row?.telegramChatId).toBe("111")
})

test("notifyManager uses the linked chat and falls back to the owner's email after unlinking", async () => {
  const { hotelId, client } = await hotel("alerts-notify")
  telegramTo.length = 0
  emails.length = 0
  expect(await notifyManager(ctx(), hotelId, "low score")).toBe("email")
  expect(emails[0]?.to).toBe("alerts-notify@le-hoetel.test")

  const { code } = await client.hotel.alerts.link()
  await linkTelegramChat(app.services.db, code, "333", new Date())
  expect(await notifyManager(ctx(), hotelId, "low score")).toBe("telegram")
  expect(telegramTo).toEqual(["333"])

  await client.hotel.alerts.unlink()
  expect(await notifyManager(ctx(), hotelId, "low score")).toBe("email")
})
