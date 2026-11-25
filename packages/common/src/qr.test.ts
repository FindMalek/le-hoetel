import { expect, test } from "bun:test"
import { captureUrl, parseSpots, QR_SPOTS_MAX } from "./qr"

test("spots: ranges expand, lists split, repeats and blanks go, the count is capped", () => {
  expect(parseSpots("101-103, T1\nT1,, Pool")).toEqual(["101", "102", "103", "T1", "Pool"])
  expect(parseSpots("1-9999")).toHaveLength(QR_SPOTS_MAX)
})

test("the capture url carries the source and the spot", () => {
  expect(captureUrl("https://ritorno.dev/", "palais", "room", "12 A")).toBe(
    "https://ritorno.dev/h/palais?src=room&loc=12+A",
  )
  expect(captureUrl("https://ritorno.dev", "palais", "desk")).toBe("https://ritorno.dev/h/palais?src=desk")
})
