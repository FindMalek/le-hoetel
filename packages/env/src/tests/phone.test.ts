import { expect, test } from "bun:test"
import { loadApiEnv } from "../api"
import { nextEnv } from "../next"

test("phone values accept a leading + and spaces", () => {
  expect(nextEnv({ WHATSAPP_CONTACT_NUMBER: " +216 12 345 678 " }).WHATSAPP_CONTACT_NUMBER).toBe("21612345678")
  expect(nextEnv({ WHATSAPP_CONTACT_NUMBER: " " }).WHATSAPP_CONTACT_NUMBER).toBeUndefined()
  expect(() => nextEnv({ WHATSAPP_CONTACT_NUMBER: "call us" })).toThrow(/WHATSAPP_CONTACT_NUMBER/)
  const api = loadApiEnv({
    DATABASE_URL: "postgres://localhost/app",
    BETTER_AUTH_SECRET: "s".repeat(32),
    WHATSAPP_NOTIFY_TO: "+1 555 123 4567",
  })
  expect(api.WHATSAPP_NOTIFY_TO).toBe("+15551234567")
})

test("the log level ignores case and spaces", () => {
  expect(nextEnv({ LOG_LEVEL: " WARN " }).LOG_LEVEL).toBe("warn")
})
