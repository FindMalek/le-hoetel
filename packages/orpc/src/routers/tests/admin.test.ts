import { afterAll, beforeAll, expect, test } from "bun:test"
import { LOW_BALANCE_MILLIMES } from "@ritorno/common/pricing"
import { hotelSettings } from "@ritorno/db"
import { eq } from "drizzle-orm"
import { topUp } from "../../lib/balance"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("a ban ends the user's live session and sign in until lifted, and never hits an admin", async () => {
  const admin = await app.signUp("ban-admin@ritorno.test", { role: "admin" })
  const target = await app.signUp("ban-target@ritorno.test")
  const signIn = () =>
    app.services.auth.api.signInEmail({ body: { email: "ban-target@ritorno.test", password: app.password } })

  await expect(admin.client.admin.setBanned({ userId: admin.id, banned: true })).rejects.toMatchObject({
    code: "BAD_REQUEST",
  })
  const other = await app.signUp("ban-other-admin@ritorno.test", { role: "admin" })
  await expect(admin.client.admin.setBanned({ userId: other.id, banned: true })).rejects.toMatchObject({
    code: "FORBIDDEN",
  })
  expect((await target.client.me.get()).id).toBe(target.id)
  await admin.client.admin.setBanned({ userId: target.id, banned: true })
  await expect(target.client.me.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  await expect(signIn()).rejects.toThrow()
  const banned = (await admin.client.admin.users()).users.find((user) => user.id === target.id)
  expect(banned?.banned).toBe(true)

  await admin.client.admin.setBanned({ userId: target.id, banned: false })
  const lifted = (await admin.client.admin.users()).users.find((user) => user.id === target.id)
  expect(lifted?.banned).toBe(false)
  expect((await signIn()).user.id).toBe(target.id)
  const actions = (await admin.client.admin.audit.list({ action: "admin." })).entries.map((entry) => entry.action)
  expect(actions).toEqual(expect.arrayContaining(["admin.user-ban", "admin.user-unban"]))
})

test("the platform overview flags open hotels whose WhatsApp credit ran low", async () => {
  const admin = await app.signUp("low-admin@ritorno.test", { role: "admin" })
  const owner = await app.signUp("low-owner@ritorno.test")
  const [low, full, never, closed] = await Promise.all(
    ["low-credit", "full-credit", "never-credit", "closed-credit"].map((slug) => app.createHotel(slug, owner)),
  )
  await topUp(app.services.db, low!, LOW_BALANCE_MILLIMES - 1)
  await topUp(app.services.db, full!, LOW_BALANCE_MILLIMES)
  await topUp(app.services.db, closed!, 1)
  await app.services.db
    .update(hotelSettings)
    .set({ status: "suspended" })
    .where(eq(hotelSettings.organizationId, closed!))

  const { lowBalance } = await admin.client.admin.hotels.overview()
  const ids = lowBalance.map((hotel) => hotel.id)
  expect(ids).toContain(low!)
  expect(ids).not.toContain(full!)
  expect(ids).not.toContain(never!)
  expect(ids).not.toContain(closed!)
})
