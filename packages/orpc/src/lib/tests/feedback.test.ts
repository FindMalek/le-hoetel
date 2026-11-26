import { expect, test } from "bun:test"
import { createFeedbackIssue } from "../feedback"

test("the public issue carries no contact details, links or ids", async () => {
  const calls: { url: string; init: RequestInit }[] = []
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return Response.json({ number: 42 })
  }) as unknown as typeof globalThis.fetch

  const number = await createFeedbackIssue(
    { repo: "ritorno/app", token: "t", fetch },
    {
      message:
        "Export fails for ada@ritorno.test (+216 22 123 456), see https://app.ritorno.test/u/s3cret and token 9fQ2xLm7Rk4Tz8Wb1Nc6Yd3H @octocat",
      page: "/guests/7b0c2a1e-1111-4222-8333-944455556666/edit?token=s3cret",
    },
  )

  expect(number).toBe(42)
  expect(calls[0]?.url).toBe("https://api.github.com/repos/ritorno/app/issues")
  const sent = JSON.parse(String(calls[0]?.init.body))
  expect(sent.labels).toEqual(["feedback"])
  expect(sent.body).toBe(
    "```text\nExport fails for [email] ([number]), see [link] and token [code] @octocat\n```\n\nPage: `/guests/:id/edit`",
  )
  expect(sent.title).not.toMatch(/ada|216|s3cret/)
})

/** What GitHub would receive for `message`. */
async function sentBody(message: string): Promise<string> {
  let body = ""
  const fetch = (async (_url: string, init: RequestInit) => {
    body = JSON.parse(String(init.body)).body
    return Response.json({ number: 1 })
  }) as unknown as typeof globalThis.fetch
  await createFeedbackIssue({ repo: "ritorno/app", token: "t", fetch }, { message })
  return body
}

test("disguised phone numbers and emails are cut too", async () => {
  const phones = ["22‑123‑456", "22–123–456", "22,123,456", "22_123_456", "22‎123‎456"]
  const emails = ["ada @ hotel.com", "ada＠hotel.com", "ada%40hotel.com"]
  expect(await sentBody([...phones, ...emails].join("; "))).toBe(
    `\`\`\`text\n${[...phones.map(() => "[number]"), ...emails.map(() => "[email]")].join("; ")}\n\`\`\``,
  )
})

test("backticks in the message cannot close the code block", async () => {
  expect(await sentBody("```\n@octocat")).toBe("````text\n```\n@octocat\n````")
})
