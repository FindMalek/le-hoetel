import { expect, test } from "bun:test"
import { captureUrl, newShortCode, normalizeShortCode, parseSpots, QR_SPOTS_MAX, qrFileName, staffLabel } from "../qr"

test("spots: ranges expand, lists split, repeats and blanks go", () => {
  expect(parseSpots("101-103, T1\nT1,, Pool")).toEqual({ spots: ["101", "102", "103", "T1", "Pool"], cut: false })
  expect(parseSpots(" ,\n ").spots).toEqual([])
})

test("spots: a reversed range reads like the right way round", () => {
  expect(parseSpots("103-101").spots).toEqual(["101", "102", "103"])
})

test("spots: past the limit the list is cut and says so, repeats do not count", () => {
  expect(parseSpots("1-100, 5")).toMatchObject({ cut: false })
  const over = parseSpots("1-100, Pool")
  expect([over.spots.length, over.cut]).toEqual([QR_SPOTS_MAX, true])
  expect(parseSpots("1-99999").cut).toBe(true)
})

test("file names keep the source and tell non latin spots apart", () => {
  expect(qrFileName("room", "301", "svg")).toBe("qr-room-301.svg")
  expect(qrFileName("table", "Terrasse été/2", "png")).toBe("qr-table-Terrasse_été_2.png")
  expect(qrFileName("table", "الشرفة", "svg")).not.toBe(qrFileName("table", "المسبح", "svg"))
})

test("the capture url carries the source and the spot", () => {
  expect(captureUrl("https://ritorno.dev/", "palais", "room", "12 A")).toBe(
    "https://ritorno.dev/h/palais?src=room&loc=12+A",
  )
  expect(captureUrl("https://ritorno.dev", "palais", "desk")).toBe("https://ritorno.dev/h/palais?src=desk")
})

test("the staff label marks table numbers with a T and leaves rooms and names alone", () => {
  expect([staffLabel("table", "4"), staffLabel("table", "T4"), staffLabel("room", "383")]).toEqual(["T4", "T4", "383"])
  expect(staffLabel("desk", null)).toBeNull()
})

test("short codes avoid look-alike characters and can be typed in lower case", () => {
  const codes = Array.from({ length: 200 }, newShortCode).join("")
  expect(codes).toMatch(/^[2-9BCDFGHJKMNP-TV-Z]{1600}$/)
  expect(normalizeShortCode(" ab3k7m ")).toBe("AB3K7M")
})
