import { afterAll, beforeAll, expect, test } from "bun:test"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

const scan = {
  name: "Amel Ben Salah",
  language: "fr",
  source: "desk",
  consents: { email: false, whatsapp: false },
} as const

async function hotelWithWelcome(slug: string) {
  const owner = await app.signUp(`${slug}@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  const { client } = await app.joinHotel(owner, hotelId, "owner")
  await client.offers.create({ title: "Welcome drink", promoCode: "WELCOME", trigger: "welcome" })
  const capture = (phone: string, claim: string) =>
    app.anonymous.public.capture({ slug, ...scan, phone, claim }).then((result) => result.perk!)
  const page = (url: string) => app.anonymous.public.offer({ token: url.split("/o/")[1]! })
  return { client, capture, page }
}

test("a guest who consents to nothing gets a code on screen that the desk redeems once, and can reopen it", async () => {
  const { client, capture, page } = await hotelWithWelcome("perk-no-consent")

  const perk = await capture("20 111 111", "browser-a")
  expect(perk.qrSvg).toContain("<svg")
  expect(await page(perk.url)).toMatchObject({ code: perk.code, state: "ready", language: "fr" })

  expect(await client.offers.redeem({ code: perk.code })).toMatchObject({ status: "redeemed", justNow: true })
  expect(await client.offers.redeem({ code: perk.code })).toMatchObject({ status: "redeemed", justNow: false })
  expect((await page(perk.url)).state).toBe("redeemed")
})

test("typing a known phone answers like a new one and never gives that guest's code", async () => {
  const { client, capture, page } = await hotelWithWelcome("perk-known-phone")
  const mine = await capture("20 222 222", "browser-a")
  // the same browser retrying a lost answer
  expect((await capture("20 222 222", "browser-a")).code).toBe(mine.code)
  await client.offers.redeem({ code: mine.code })

  const stranger = await capture("20 222 222", "browser-b")
  const fresh = await capture("20 333 333", "browser-b")

  expect(Object.keys(stranger).sort()).toEqual(Object.keys(fresh).sort())
  expect(stranger.code).not.toBe(mine.code)
  expect((await page(stranger.url)).state).toBe((await page(fresh.url)).state)
  expect(await client.offers.lookup({ code: stranger.code })).toMatchObject({ status: "unknown" })
})
