import { afterAll, beforeAll, expect, test } from "bun:test"
import { createTestApp, type TestApp } from "@ritorno/orpc/testing"
import { hmacSha256 } from "@ritorno/webhooks"
import { createServer } from "../server"

const ORIGIN = "http://localhost:3002"
const PASSWORD = "correct horse battery"

let app: TestApp
let handle: (request: Request) => Promise<Response>
beforeAll(async () => {
  app = await createTestApp()
  handle = createServer(app.services, { publicUrl: "http://localhost:3001" })
})
afterAll(() => app.close())

const call = (path: string, init: RequestInit = {}) => handle(new Request(`http://localhost:3001${path}`, init))

test("/health reports the database", async () => {
  const response = await call("/health")
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true, db: true, env: "test" })
})

test("sign up over http, then use the session cookie on the REST api", async () => {
  const signUp = await call("/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify({ email: "web@ritorno.test", password: PASSWORD, name: "Web" }),
  })
  expect(signUp.status).toBe(200)
  const cookie = signUp.headers
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
