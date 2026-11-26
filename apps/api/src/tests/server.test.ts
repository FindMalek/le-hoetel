import { afterAll, beforeAll, expect, spyOn, test } from "bun:test"
import { signScanCode } from "@ritorno/common/whatsapp-scan"
import { guestConsents, guests, messages, whatsappScans } from "@ritorno/db"
import type { Notifier } from "@ritorno/notification"
import { createTestApp, type TestApp } from "@ritorno/orpc/testing"
import { hmacSha256 } from "@ritorno/webhooks"
import { createServer } from "../server"

const ORIGIN = "http://localhost:3002"

let app: TestApp
let handle: (request: Request) => Promise<Response>
beforeAll(async () => {
  app = await createTestApp()
  handle = createServer(app.services, { publicUrl: "http://localhost:3001" })
})
afterAll(() => app.close())

const call = (path: string, init: RequestInit = {}) => handle(new Request(`http://localhost:3001${path}`, init))

test("/health reports the database and the build sha", async () => {
  const services = { ...app.services, config: { ...app.services.config, gitSha: "abc123" } }
  const response = await createServer(services, { publicUrl: "http://localhost:3001" })(
    new Request("http://localhost:3001/health"),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true, db: true, env: "test", sha: "abc123" })
})

test("sign in over http, then use the session cookie on the REST api", async () => {
  await app.signUp("web@ritorno.test")
  const signIn = await call("/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ email: "web@ritorno.test", password: app.password }),
  })
  expect(signIn.status).toBe(200)
  const cookie = signIn.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")

  const me = await call("/v1/me", { headers: { cookie, "x-csrf-token": "orpc" } })
  expect(me.status).toBe(200)
  expect(await me.json()).toMatchObject({ email: "web@ritorno.test" })

  expect((await call("/v1/me", { headers: { "x-csrf-token": "orpc" } })).status).toBe(401)
})

test("unknown paths are a 404", async () => {
  expect((await call("/nope")).status).toBe(404)
})

test("the Resend webhook needs a valid svix signature", async () => {
  const secret = `whsec_${Buffer.from("resend-test-secret").toString("base64")}`
  const withSecret = createServer(
    { ...app.services, config: { ...app.services.config, webhookSecrets: { resend: secret } } },
    { publicUrl: "http://localhost:3001" },
  )
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "re_unknown" } })
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = hmacSha256(Buffer.from("resend-test-secret"), `msg_1.${timestamp}.${body}`, "base64")
  const post = (headers: Record<string, string>) =>
    withSecret(new Request("http://localhost:3001/resend/webhook", { method: "POST", headers, body }))

  expect((await post({ "svix-id": "msg_1", "svix-timestamp": timestamp, "svix-signature": "v1,nope" })).status).toBe(
    401,
  )
  expect(
    (await post({ "svix-id": "msg_1", "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` })).status,
  ).toBe(200)
  expect((await call("/resend/webhook", { method: "POST", body })).status).toBe(404)
})

test("the WhatsApp webhook needs a valid signature header", async () => {
  const secret = "kapso-test-secret"
  const withSecret = createServer(
    { ...app.services, config: { ...app.services.config, webhookSecrets: { kapso: secret } } },
    { publicUrl: "http://localhost:3001" },
  )
  const body = JSON.stringify({ message: { id: "wamid.unknown", kapso: { direction: "outbound" } } })
  const post = (signature: string) =>
    withSecret(
      new Request("http://localhost:3001/whatsapp/webhook", {
        method: "POST",
        headers: { "x-webhook-event": "whatsapp.message.delivered", "x-webhook-signature": signature },
        body,
      }),
    )

  expect((await post("nope")).status).toBe(401)
  expect((await post(hmacSha256(secret, body))).status).toBe(200)
  expect((await call("/whatsapp/webhook", { method: "POST", body })).status).toBe(404)
})

test("STOP and a QR scan work from a sender with a user id and no phone", async () => {
  const owner = await app.signUp("username@ritorno.test")
  const hotelId = await app.createHotel("username", owner)
  const { db } = app.services
  const [guest] = await db
    .insert(guests)
    .values({ hotelId, name: "Amel", phoneE164: "+21620999001", language: "en", source: "qr_room" })
    .returning({ id: guests.id })
  await db
    .insert(guestConsents)
    .values({ guestId: guest!.id, hotelId, channel: "whatsapp", granted: true, source: "qr_room", wordingVersion: "1" })
  await db.insert(messages).values({
    hotelId,
    guestId: guest!.id,
    channel: "whatsapp",
    templateKey: "welcome",
    language: "en",
    status: "sent",
    providerId: "wamid.ours",
  })

  const replies: unknown[] = []
  const notification = {
    replyWhatsApp: async (to: unknown) => {
      replies.push(to)
      return { channel: "whatsapp", sent: true }
    },
  } as unknown as Notifier
  const secret = "kapso-test-secret"
  const server = createServer(
    { ...app.services, notification, config: { ...app.services.config, webhookSecrets: { kapso: secret } } },
    { publicUrl: "http://localhost:3001" },
  )
  const receive = async (id: string, text: string, context?: { id: string }) => {
    const body = JSON.stringify({
      message: { id, type: "text", from_user_id: "TN.123456", text: { body: text }, context },
      conversation: { phone_number: null, business_scoped_user_id: "TN.123456" },
    })
    const headers = { "x-webhook-event": "whatsapp.message.received", "x-webhook-signature": hmacSha256(secret, body) }
    const init = { method: "POST", headers, body }
    expect((await server(new Request("http://localhost:3001/whatsapp/webhook", init))).status).toBe(200)
  }
  const consent = async () => (await db.select().from(guestConsents))[0]!.granted

  const spot = { slug: "username", source: "room", language: "en", location: "12" } as const
  await receive("wamid.scan", signScanCode(app.services.config.tokenSecret, spot))
  expect(replies).toEqual([{ userId: "TN.123456" }])
  expect(await db.select().from(whatsappScans)).toHaveLength(0)

  const warn = spyOn(console, "warn").mockImplementation(() => {})
  await receive("wamid.stop-1", "STOP")
  expect(warn.mock.calls).toEqual([["[whatsapp-stop] sender not matched, no consent changed"]])
  expect(await consent()).toBe(true)
  warn.mockRestore()

  await receive("wamid.stop-2", "STOP", { id: "wamid.ours" })
  expect(await consent()).toBe(false)
})
