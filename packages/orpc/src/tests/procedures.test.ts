import { afterAll, beforeAll, expect, test } from "bun:test"
import { call } from "@orpc/server"
import { guests } from "@ritorno/db"
import { logger } from "@ritorno/logger"
import { createContext } from "../context"
import { publicProcedure } from "../procedures"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("a failed insert is logged as its error class and code, without the guest's phone or name", async () => {
  const lines: string[] = []
  logger.configure({ write: (line) => lines.push(line) })
  const insert = publicProcedure.handler(({ context }) =>
    context.db.insert(guests).values({
      hotelId: "no-such-hotel",
      name: "Amel Ben Salah",
      phoneE164: "+21620123456",
      language: "fr",
      source: "qr_room",
    }),
  )

  await expect(call(insert, undefined, { context: await createContext(app.services, new Headers()) })).rejects.toThrow()

  const logged = lines.join("\n")
  expect(logged).toContain("procedure failed")
  expect(logged).toContain("23503")
  expect(logged).not.toContain("20123456")
  expect(logged).not.toContain("Amel")
})
