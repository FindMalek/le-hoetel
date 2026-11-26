import { afterAll, beforeAll, expect, spyOn, test } from "bun:test"
import { RATE_LIMITS } from "../../lib/rate-limit"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp

beforeAll(async () => {
  app = await createTestApp()
  Object.assign(app.services.config, { githubRepo: "ritorno/app", githubToken: "t" })
})
afterAll(() => app.close())

test("a new ip on every call still hits the global cap", async () => {
  const github = spyOn(globalThis, "fetch").mockImplementation((async () =>
    Response.json({ number: 1 })) as unknown as typeof fetch)
  const send = (n: number) =>
    app
      .clientFor(new Headers({ "x-csrf-token": "orpc", "x-forwarded-for": `10.0.0.${n}` }))
      .feedback.send({ message: "The export button is hard to find" })
  try {
    for (let n = 0; n < RATE_LIMITS.feedbackAll.limit; n++) await send(n)
    await expect(send(200)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" })
    expect(github).toHaveBeenCalledTimes(RATE_LIMITS.feedbackAll.limit)
  } finally {
    github.mockRestore()
  }
})
