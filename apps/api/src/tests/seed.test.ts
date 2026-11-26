import { afterAll, beforeAll, expect, test } from "bun:test"
import { organization } from "@ritorno/db"
import { seedRefusal } from "@ritorno/db/seed"
import { createTestDb, type TestDb } from "@ritorno/db/testing"
import { seedOnBoot } from "../seed"

let testDb: TestDb
beforeAll(async () => {
  testDb = await createTestDb()
})
afterAll(() => testDb.close())

const REMOTE = "postgres://u:p@db.example.com:5432/ritorno"
const boot = (deployEnv: string) =>
  seedOnBoot(testDb.db, { deployEnv, databaseUrl: REMOTE, hashPassword: async (p) => p })

test("boot skips a remote database unless the deploy env is a staging or preview one", async () => {
  await boot("local")
  await boot("production")
  expect(await testDb.db.select().from(organization)).toEqual([])

  await boot("staging")
  expect((await testDb.db.select().from(organization)).length).toBeGreaterThan(0)
  expect(seedRefusal({ deployEnv: "pr-298", databaseUrl: REMOTE })).toBeNull()
}, 60_000)
