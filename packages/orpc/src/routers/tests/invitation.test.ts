import { afterAll, beforeAll, expect, test } from "bun:test"
import { member } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("the invited owner reads an invitation whose inviter left the hotel, nobody else does", async () => {
  const admin = await app.signUp("admin@example.com", { role: "admin" })
  const hotel = await admin.client.admin.hotels.create({ name: "Dar", slug: "dar", ownerEmail: "owner@example.com" })
  expect(await app.services.db.select().from(member).where(eq(member.organizationId, hotel.id))).toEqual([])
  const detail = await admin.client.admin.hotels.get({ id: hotel.id })
  const id = detail.invitations[0]?.id ?? ""

  const owner = await app.signUp("owner@example.com")
  expect(await owner.client.me.invitation({ id })).toEqual({
    organizationName: "Dar",
    inviterEmail: "admin@example.com",
    role: "owner",
  })
  const other = await app.signUp("other@example.com")
  await expect(other.client.me.invitation({ id })).rejects.toMatchObject({ code: "FORBIDDEN" })
})
