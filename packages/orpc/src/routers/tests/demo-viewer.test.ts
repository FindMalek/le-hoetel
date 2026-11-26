import { afterAll, beforeAll, expect, test } from "bun:test"
import { DEMO_VIEWER_EMAIL } from "@ritorno/common/demo"
import { createTestApp } from "../../testing"

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
  expect(await viewer.client.hotel.qrCodes({ source: "desk", spots: [] })).toHaveLength(1)

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
  expect((await post("/sign-out", {})).status).toBe(200)
})
