import { afterAll, beforeAll, expect, test } from "bun:test"
import { createRouterClient } from "@orpc/server"
import { INVITATION_ID_HEADER } from "@ritorno/common/constants"
import { DEMO_VIEWER_EMAIL } from "@ritorno/common/demo"
import { shortLinks } from "@ritorno/db"
import { createContext } from "../../context"
import { createTestApp } from "../../testing"
import { appRouter } from ".."

let app: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("the demo viewer looks around its hotel but changes nothing", async () => {
  const owner = await app.signUp("owner@viewer.test")
  const hotelId = await app.createHotel("viewer-hotel", owner)
  const viewer = await app.joinHotel(await app.signUp(DEMO_VIEWER_EMAIL), hotelId, "manager")

  expect((await viewer.client.hotel.get()).id).toBe(hotelId)
  // a code that scans, without a row being made for it
  const [code] = await viewer.client.hotel.qrCodes({ source: "desk", spots: [] })
  expect(code?.url).toEndWith("/h/viewer-hotel?src=desk")
  expect(await app.services.db.select().from(shortLinks)).toHaveLength(0)
  expect((await viewer.client.emails.preview({ template: "welcome", locale: "en" })).subject).toBeTruthy()
  expect((await viewer.client.offers.lookup({ code: "NOPE" })).status).toBe("unknown")

  const refused = { code: "FORBIDDEN", message: "This demo account is view only." }
  await expect(
    viewer.client.guests.create({
      name: "Real Person",
      phone: "+21698123456",
      language: "fr",
      source: "staff",
      consents: { email: false, whatsapp: false, profile: false },
    }),
  ).rejects.toMatchObject(refused)
  await expect(viewer.client.me.update({ name: "Prospect" })).rejects.toMatchObject(refused)
  await expect(viewer.client.guests.exportAll()).rejects.toMatchObject(refused)
  await expect(viewer.client.guests.exportCsv({})).rejects.toMatchObject(refused)
  await expect(viewer.client.guests.export({ id: crypto.randomUUID() })).rejects.toMatchObject(refused)
  await expect(viewer.client.privacy.export()).rejects.toMatchObject(refused)

  // Another hotel stays closed, whether named on a call or picked in the session.
  const other = await app.createHotel("other-hotel", await app.signUp("other@viewer.test"))
  const naming = new Headers(viewer.headers)
  naming.set("x-hotel-id", other)
  const elsewhere = createRouterClient(appRouter, { context: () => createContext(app.services, naming) })
  await expect(elsewhere.guests.list({})).rejects.toMatchObject({ code: "FORBIDDEN" })

  // Auth has its own routes next to the procedures: the same refusal over http, as the dashboard reaches them.
  const post = (path: string, body: object) =>
    app.services.auth.handler(
      new Request(`http://localhost:3002/api/auth${path}`, {
        method: "POST",
        headers: {
          cookie: viewer.headers.get("cookie") ?? "",
          origin: "http://localhost:3002",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    )
  const takeover = { currentPassword: "correct horse battery", newPassword: "taken over 123" }
  for (const [path, body] of [
    ["/change-password", takeover],
    ["/update-user", { name: "Prospect" }],
    ["/organization/invite-member", { email: "friend@viewer.test", role: "staff" }],
  ] as const) {
    const response = await post(path, body)
    expect(await response.json()).toMatchObject({ code: "DEMO_VIEW_ONLY" })
  }
  expect((await post("/organization/set-active", { organizationId: other })).status).toBe(403)
  expect((await post("/sign-out", {})).status).toBe(200)
})

test("a seeded demo invitation cannot be claimed by signing up", async () => {
  const owner = await app.signUp("owner@claim.test")
  const hotelId = await app.createHotel("claim-hotel", owner)
  const email = "night.claim-hotel@demo.ritorno.test"
  const { id } = await app.services.auth.api.createInvitation({
    body: { email, role: "staff", organizationId: hotelId },
    headers: owner.headers,
  })

  const response = await app.services.auth.handler(
    new Request("http://localhost:3002/api/auth/sign-up/email", {
      method: "POST",
      headers: { origin: "http://localhost:3002", "content-type": "application/json", [INVITATION_ID_HEADER]: id },
      body: JSON.stringify({ email, password: "taken over 123", name: "Stranger" }),
    }),
  )
  expect(await response.json()).toMatchObject({ code: "INVITATION_REQUIRED" })
})
