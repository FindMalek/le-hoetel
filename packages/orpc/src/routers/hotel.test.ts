import { afterAll, beforeAll, expect, test } from "bun:test"
import { hotelSettings, invitation } from "@le-hoetel/db"
import { eq } from "drizzle-orm"
import { createTestApp, type TestApp } from "../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("the app admin creates a hotel with branding and invites the owner, who joins on accepting", async () => {
  const admin = await app.signUp("hotel-admin@le-hoetel.test", { role: "admin" })
  const owner = await app.signUp("hotel-owner@le-hoetel.test")
  const input = {
    name: "Hotel Medina",
    slug: "hotel-medina",
    ownerEmail: "Hotel-Owner@le-hoetel.test",
    primaryColor: "#0a7c66",
    defaultLanguage: "ar",
  } as const

  await expect(owner.client.admin.hotels.create(input)).rejects.toMatchObject({ code: "FORBIDDEN" })
  await expect(
    app.services.auth.api.createOrganization({ body: { name: "Self", slug: "self" }, headers: owner.headers }),
  ).rejects.toThrow()

  const hotel = await admin.client.admin.hotels.create(input)
  expect(hotel).toMatchObject({
    displayName: "Hotel Medina",
    primaryColor: "#0a7c66",
    defaultLanguage: "ar",
    timezone: "Africa/Tunis",
    status: "pilot",
  })
  await expect(admin.client.admin.hotels.create(input)).rejects.toMatchObject({ code: "CONFLICT" })

  const listed = async () => (await admin.client.admin.hotels.list()).find((h) => h.id === hotel.id)
  expect(await listed()).toMatchObject({ guestCount: 0, ownerCount: 0, health: "no-owner" })

  const [invite] = await app.services.db.select().from(invitation).where(eq(invitation.organizationId, hotel.id))
  expect(invite).toMatchObject({ email: "hotel-owner@le-hoetel.test", role: "owner" })
  await app.services.auth.api.acceptInvitation({ body: { invitationId: invite!.id }, headers: owner.headers })

  expect(await listed()).toMatchObject({ ownerCount: 1, health: "no-guests" })
  const active = await app.joinHotel(owner, hotel.id, "owner")
  await active.client.guests.create({
    name: "Amel Ben Salah",
    phone: "+21620123456",
    language: "fr",
    email: null,
    source: "qr_room",
    consents: { email: false, whatsapp: true, profile: false },
  })
  expect(await listed()).toMatchObject({ guestCount: 1, health: "healthy" })
})

test("branding: owner and manager edit it, staff only read it, plan and status stay with the admin", async () => {
  const admin = await app.signUp("brand-admin@le-hoetel.test", { role: "admin" })
  const owner = await app.signUp("brand-owner@le-hoetel.test")
  const manager = await app.signUp("brand-manager@le-hoetel.test")
  const staff = await app.signUp("brand-staff@le-hoetel.test")
  const hotelId = await app.createHotel("brand-hotel", owner)
  const asManager = await app.joinHotel(manager, hotelId, "manager")
  const asStaff = await app.joinHotel(staff, hotelId, "staff")

  const updated = await asManager.client.hotel.update({
    displayName: "Dar Zarrouk",
    primaryColor: "#0a7c66",
    accentColor: "#f2b134",
    defaultLanguage: "ar",
    replyToEmail: "hello@darzarrouk.test",
  })
  expect(updated).toMatchObject({ displayName: "Dar Zarrouk", primaryColor: "#0a7c66", defaultLanguage: "ar" })
  expect(await asStaff.client.hotel.get()).toMatchObject({ displayName: "Dar Zarrouk" })

  await expect(asStaff.client.hotel.update({ displayName: "Hacked" })).rejects.toMatchObject({ code: "FORBIDDEN" })
  await expect(asManager.client.hotel.update({ primaryColor: "red" })).rejects.toThrow()
  await expect(asManager.client.admin.hotels.update({ id: hotelId, plan: "pro" })).rejects.toMatchObject({
    code: "FORBIDDEN",
  })

  await admin.client.admin.hotels.update({ id: hotelId, plan: "pro", status: "active" })
  const [row] = await app.services.db.select().from(hotelSettings).where(eq(hotelSettings.organizationId, hotelId))
  expect(row).toMatchObject({ plan: "pro", status: "active", displayName: "Dar Zarrouk" })
})

test("a hotel user lands in their hotel at sign in and lists only their hotels", async () => {
  const owner = await app.signUp("lands-owner@le-hoetel.test")
  const hotelId = await app.createHotel("lands-hotel", owner)
  await app.createHotel("lands-other", await app.signUp("lands-other@le-hoetel.test"))
  expect(await owner.client.hotel.mine()).toEqual({ activeId: null, hotels: [{ id: hotelId, name: "lands-hotel" }] })

  const login = await app.services.auth.api.signInEmail({
    body: { email: "lands-owner@le-hoetel.test", password: app.password },
    returnHeaders: true,
  })
  const cookie = login.headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ")
  const again = app.clientFor(new Headers({ cookie, "x-csrf-token": "orpc" }))
  expect((await again.hotel.mine()).activeId).toBe(hotelId)
})
