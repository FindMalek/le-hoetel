import { expect, test } from "bun:test"
import { createLogger, REDACTED, redact, resolveRequestId, withRequestId } from "../index"

test("json lines carry the request id and never a secret", () => {
  const lines: string[] = []
  const log = createLogger({ level: "info", pretty: false, write: (line) => lines.push(line) })

  withRequestId("req-12345678", () =>
    log.info("signed in", { headers: { cookie: "session=abc", accept: "json" }, nested: { password: "hunter2" } }),
  )
  log.debug("below the level")

  expect(lines).toHaveLength(1)
  const entry = JSON.parse(lines[0]!)
  expect(entry).toMatchObject({
    level: "info",
    msg: "signed in",
    requestId: "req-12345678",
    headers: { cookie: REDACTED, accept: "json" },
    nested: { password: REDACTED },
  })
})

test("a wrapped error keeps its cause", () => {
  const error = new Error("outer", { cause: new Error("inner") })
  expect(redact(error)).toMatchObject({ message: "outer", cause: { message: "inner" } })
})

test("an inbound request id is kept only when it is plain", () => {
  expect(resolveRequestId("abc-12345678")).toBe("abc-12345678")
  expect(resolveRequestId("bad id\nwith newline")).not.toContain("\n")
})

test("guest phone, email and name never reach a log line", () => {
  const entry = redact({
    guest: { name: "Ada Lovelace", phone: "+21612345678", email: "ada@example.com", language: "fr" },
    whatsappNumber: "+21612345678",
    err: new Error("bounce for ada@example.com"),
    hostname: "api-1",
  }) as { guest: unknown; whatsappNumber: string; err: { message: string }; hostname: string }

  expect(entry.guest).toEqual({ name: REDACTED, phone: REDACTED, email: REDACTED, language: "fr" })
  expect(entry.whatsappNumber).toBe(REDACTED)
  expect(entry.err.message).toBe(`bounce for ${REDACTED}`)
  expect(entry.hostname).toBe("api-1")
  expect(JSON.stringify(entry)).not.toMatch(/Ada|2161234|ada@/)
})

test("phone numbers inside text are masked in every common Tunisian shape, ordinary numbers stay", () => {
  for (const phone of [
    "+216 20 123 456",
    "+21620123456",
    "00216 20 123 456",
    "20 123 456",
    "20.123.456",
    "20 12 34 56",
    "20123456",
  ]) {
    expect(redact(`call ${phone} now`)).toBe(`call ${REDACTED} now`)
  }
  const ordinary = "order 4521 on 2026-11-26T10:00:00.000Z for 1 500 TND, 12.50 eur, id 1732600000000, year 2026"
  expect(redact(ordinary)).toBe(ordinary)
})
