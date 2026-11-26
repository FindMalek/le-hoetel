import { expect, test } from "bun:test"
import { DEMO_VIEWER_EMAIL } from "@ritorno/common/demo"
import { eq } from "drizzle-orm"
import { account, user } from "../../schema"
import { createTestDb } from "../../testing"
import { seedDemo } from "../index"

async function viewerPasswords(viewerPassword?: string) {
  const testDb = await createTestDb()
  try {
    await seedDemo(testDb.db, {
      hashPassword: async (p) => `hash:${p}`,
      demoPassword: "shared-with-admin",
      viewerPassword,
      deployEnv: "staging",
      databaseUrl: testDb.url,
    })
    return await testDb.db
      .select({ password: account.password })
      .from(user)
      .innerJoin(account, eq(account.userId, user.id))
      .where(eq(user.email, DEMO_VIEWER_EMAIL))
  } finally {
    await testDb.close()
  }
}

test("a deployed env gets the sales viewer only with its own password", async () => {
  expect(await viewerPasswords()).toEqual([])
  expect(await viewerPasswords("viewer-only")).toEqual([{ password: "hash:viewer-only" }])
  // Two full seeds.
}, 60_000)
