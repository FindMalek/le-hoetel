import { expect, test } from "bun:test"
import { createNotifier } from "../index"

const LIVE = { NODE_ENV: "production", MESSAGING_LIVE: "true" }

function recorder() {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const doFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return Response.json({ ok: true, result: {}, id: "msg_1", messages: [{ id: "wamid_1" }] })
  }) as unknown as typeof fetch
  return { calls, doFetch }
}

test("only channels with keys are on, and the others are skipped", async () => {
  const { calls, doFetch } = recorder()
  const notifier = createNotifier(
    { ...LIVE, TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "42" },
    { fetch: doFetch },
  )

  expect(notifier.channels).toEqual(["telegram"])
  expect(
    await notifier.send({ channel: "email", to: "ada@example.com", template: "test", data: { url: "x" } }),
  ).toEqual({
    channel: "email",
    sent: false,
  })
  const results = await notifier.notify("deploy done")

  expect(results).toEqual([{ channel: "telegram", sent: true, id: undefined }])
  expect(calls).toHaveLength(1)
  expect(calls[0]?.url).toContain("api.telegram.org/bot123:abc/sendMessage")
  expect(calls[0]?.body).toEqual({ chat_id: "42", text: "deploy done" })
})

test("send renders the template for each channel it goes to", async () => {
  const { calls, doFetch } = recorder()
  const notifier = createNotifier(
    {
      ...LIVE,
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "Ritorno <hello@example.com>",
      TELEGRAM_BOT_TOKEN: "123:abc",
      TELEGRAM_CHAT_ID: "42",
    },
    { fetch: doFetch, appUrl: "https://app.test" },
  )
  expect(notifier.channels).toEqual(["email", "telegram"])

  const data = { name: "Ada", url: "https://app.test/verify?t=1" }
  const email = await notifier.send({ channel: "email", to: "ada@example.com", template: "verifyEmail", data })
  await notifier.send({ channel: "telegram", template: "verifyEmail", data })

  expect(email).toEqual({ channel: "email", sent: true, id: "msg_1" })
  expect(calls[0]?.url).toContain("resend.com")
  expect(calls[0]?.body).toMatchObject({ from: "Ritorno <hello@example.com>", subject: "Verify your email" })
  expect(String(calls[0]?.body.html)).toContain("https://app.test/verify?t=1")
  expect(calls[1]?.body).toMatchObject({ chat_id: "42", parse_mode: "Markdown" })
  expect(String(calls[1]?.body.text)).toContain("*Verify your email*")
})

test("whatsapp sends the template as one line through kapso", async () => {
  const { calls, doFetch } = recorder()
  const notifier = createNotifier(
    { ...LIVE, KAPSO_API_KEY: "k", WHATSAPP_PHONE_NUMBER_ID: "555", WHATSAPP_NOTIFY_TO: "+15551234567" },
    { fetch: doFetch },
  )

  const result = await notifier.send({ channel: "whatsapp", template: "test", data: { url: "https://app.test" } })

  expect(result).toEqual({ channel: "whatsapp", sent: true, id: "wamid_1" })
  expect(JSON.stringify(calls[0]?.body)).toContain("Test message.")
})

test("telegram links keep a closing paren and whatsapp titles dont get a double stop", async () => {
  const { toTelegram, toWhatsApp } = await import("../render")
  const summary = { title: "Done!", lines: [], link: { label: "Open", url: "https://a.test/x_(1)" } }

  expect(toTelegram(summary)).toContain("(https://a.test/x_(1%29)")
  expect(toWhatsApp(summary)).toStartWith("Done! https://")
})

test("the telegram webhook rejects calls without the secret and answers 404 when off", async () => {
  const on = createNotifier({ ...LIVE, TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_WEBHOOK_SECRET: "s3cret" })
  const off = createNotifier(LIVE)
  const request = (secret?: string) =>
    new Request("http://api/telegram/webhook", {
      method: "POST",
      headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {},
      body: JSON.stringify({ update_id: 1 }),
    })

  expect((await on.handleTelegramWebhook(request())).status).toBe(403)
  expect((await on.handleTelegramWebhook(request("s3cret"))).status).toBe(200)
  expect((await off.handleTelegramWebhook(request("s3cret"))).status).toBe(404)
})

test("outside live messaging nothing is sent and the log carries no recipient or text", async () => {
  const { calls, doFetch } = recorder()
  const lines: string[] = []
  const log = { info: (message: string, fields?: object) => lines.push(JSON.stringify({ message, ...fields })) }
  const keys = { RESEND_API_KEY: "re_test", TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_ID: "42" }
  const options = { fetch: doFetch, log: log as never }

  for (const env of [{ ...keys, NODE_ENV: "production" }, { ...keys, MESSAGING_LIVE: "true" }, keys]) {
    const notifier = createNotifier(env, options)
    const result = await notifier.send({
      channel: "email",
      to: "ada@example.com",
      template: "verifyEmail",
      data: { name: "Ada", url: "https://app.test/verify?t=1" },
    })
    await notifier.notify("hello Ada")
    expect(result).toEqual({ channel: "email", sent: false })
  }

  expect(calls).toHaveLength(0)
  expect(lines[0]).toBe('{"message":"message not sent, log-only provider","channel":"email","template":"verifyEmail"}')
  expect(lines.join()).not.toMatch(/ada|hello/i)
})

test("a footer ends the email in both bodies and the whatsapp text", async () => {
  const { calls, doFetch } = recorder()
  const notifier = createNotifier(
    {
      ...LIVE,
      RESEND_API_KEY: "re_test",
      KAPSO_API_KEY: "k",
      WHATSAPP_PHONE_NUMBER_ID: "1",
      WHATSAPP_NOTIFY_TO: "+21620000000",
    },
    { fetch: doFetch },
  )
  const footer = "Unsubscribe: https://web.test/u/abc"

  await notifier.send({ channel: "email", to: "ada@example.com", template: "test", data: { url: "x" }, footer })
  await notifier.send({ channel: "whatsapp", template: "test", data: { url: "x" }, footer })

  const body = calls[0]?.body as { html: string; text: string }
  expect(body.text.endsWith(footer)).toBe(true)
  expect(body.html).toContain('<a href="https://web.test/u/abc">')
  expect(JSON.stringify(calls[1]?.body)).toContain(footer)
})

test("a rendered hotel email goes out from the hotel's name with reply-to and list headers", async () => {
  const { calls, doFetch } = recorder()
  const notifier = createNotifier(
    { ...LIVE, RESEND_API_KEY: "re_test", EMAIL_FROM: "Ritorno <hello@example.com>" },
    { fetch: doFetch },
  )

  await notifier.sendEmail({
    to: "ada@example.com",
    email: { subject: "Hi", html: "<p>Hi</p>", text: "Hi" },
    fromName: 'Dar "Amel" <Hotel>',
    replyTo: "desk@dar-amel.test",
    headers: { "List-Unsubscribe": "<https://api.test/unsubscribe/t>" },
  })

  expect(calls[0]?.body).toMatchObject({
    from: '"Dar Amel Hotel" <hello@example.com>',
    reply_to: ["desk@dar-amel.test"],
    headers: { "List-Unsubscribe": "<https://api.test/unsubscribe/t>" },
  })
})

test("a guest template goes to kapso by name and language with named variables", async () => {
  const { calls, doFetch } = recorder()
  const notifier = createNotifier({ ...LIVE, KAPSO_API_KEY: "k", WHATSAPP_PHONE_NUMBER_ID: "555" }, { fetch: doFetch })

  const result = await notifier.sendWhatsApp({
    to: "+21620222222",
    template: "guest_welcome",
    language: "ar",
    params: { guest_name: "Amel", hotel_name: "Dar Amel" },
  })

  expect(result).toEqual({ channel: "whatsapp", sent: true, id: "wamid_1" })
  expect(calls[0]?.body).toMatchObject({
    to: "+21620222222",
    template: {
      name: "guest_welcome",
      language: { code: "ar" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "Amel", parameter_name: "guest_name" },
            { type: "text", text: "Dar Amel", parameter_name: "hotel_name" },
          ],
        },
      ],
    },
  })
})

test("/start with a code hands the chat id to the binder and replies with the outcome", async () => {
  const { calls, doFetch } = recorder()
  const notifier = createNotifier(
    { ...LIVE, TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_WEBHOOK_SECRET: "s3cret" },
    { fetch: doFetch },
  )
  const bound: string[] = []
  const start = (text: string) =>
    new Request("http://api/telegram/webhook", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": "s3cret" },
      body: JSON.stringify({ update_id: 1, message: { chat: { id: 99 }, text } }),
    })
  const binder = async (code: string, chatId: string) => {
    bound.push(`${code}:${chatId}`)
    return code === "good"
  }

  await notifier.handleTelegramWebhook(start("/start good"), binder)
  await notifier.handleTelegramWebhook(start("/start bad"), binder)

  expect(bound).toEqual(["good:99", "bad:99"])
  expect(String(calls[0]?.body.text)).toContain("Linked")
  expect(String(calls[1]?.body.text)).toContain("invalid or expired")
})
