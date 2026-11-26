import { afterAll, beforeAll, expect, test } from "bun:test"
import { LOGO_MAX_BYTES } from "@ritorno/common/hotel"
import type { Storage } from "@ritorno/storage"
import { isPublicKey } from "@ritorno/storage"
import { createTestApp, type TestApp } from "../../testing"

const objects = new Map<string, { size: number; type: string }>()
const storage: Storage = {
  bucket: "test",
  prefix: "pr-1/",
  put: async () => {},
  url: (key) => `https://s3.test/${key}`,
  presignPut: (key) => `https://s3.test/${key}?signed`,
  stat: async (key) => objects.get(key) ?? null,
  remove: async (key) => void objects.delete(key),
}

let app: TestApp
beforeAll(async () => {
  app = await createTestApp({ storage })
})
afterAll(() => app.close())

async function hotelAs(slug: string) {
  const owner = await app.signUp(`${slug}-owner@ritorno.test`)
  const hotelId = await app.createHotel(slug, owner)
  return { hotelId, ...(await app.joinHotel(owner, hotelId, "owner")) }
}

test("a logo is uploaded under the hotel's own prefix and no hotel can point at another's files", async () => {
  const a = await hotelAs("logo-a")
  const b = await hotelAs("logo-b")

  await expect(a.client.hotel.logo.uploadUrl({ type: "image/svg+xml", size: 100 })).rejects.toThrow()
  await expect(a.client.hotel.logo.uploadUrl({ type: "image/png", size: LOGO_MAX_BYTES + 1 })).rejects.toThrow()

  const upload = await a.client.hotel.logo.uploadUrl({ type: "image/png", size: 2000 })
  expect(upload.key).toStartWith(`pr-1/hotels/${a.hotelId}/public/logo-`)
  expect(upload.headers).toEqual({ "content-type": "image/png" })

  await expect(a.client.hotel.logo.set({ key: upload.key })).rejects.toMatchObject({ code: "NOT_FOUND" })
  objects.set(upload.key, { size: 2000, type: "image/png" })
  expect(await a.client.hotel.logo.set({ key: upload.key })).toMatchObject({ logoKey: upload.key })

  await expect(b.client.hotel.logo.set({ key: upload.key })).rejects.toMatchObject({ code: "FORBIDDEN" })
  await expect(
    a.client.hotel.update({ logoKey: `pr-1/hotels/${b.hotelId}/public/x.png` } as never),
  ).resolves.toMatchObject({
    logoKey: upload.key,
  })

  const oversized = (await a.client.hotel.logo.uploadUrl({ type: "image/png", size: 10 })).key
  objects.set(oversized, { size: LOGO_MAX_BYTES + 5, type: "image/png" })
  await expect(a.client.hotel.logo.set({ key: oversized })).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" })
  expect(objects.has(oversized)).toBe(false)

  expect(isPublicKey(storage, upload.key)).toBe(true)
  expect(isPublicKey(storage, `pr-1/hotels/${a.hotelId}/exports/guests.csv`)).toBe(false)
  expect(isPublicKey(storage, `pr-1/hotels/${a.hotelId}/public/../exports/guests.csv`)).toBe(false)
})
