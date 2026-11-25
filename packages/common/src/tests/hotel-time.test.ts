import { expect, test } from "bun:test"
import { birthdaysToday, isQuietHour, localTime } from "../hotel-time"

test("the same instant is a different day in Tunis and in Auckland", () => {
  const instant = new Date("2026-12-31T22:30:00Z")
  expect(localTime(instant, "Africa/Tunis")).toMatchObject({ year: 2026, monthDay: "12-31", hour: 23 })
  expect(localTime(instant, "Pacific/Auckland")).toMatchObject({ year: 2027, monthDay: "01-01", hour: 11 })
})

test("29 February is celebrated on the 28th only in a year without one", () => {
  expect(birthdaysToday(localTime(new Date("2027-02-28T10:00:00Z"), "Africa/Tunis"))).toEqual(["02-28", "02-29"])
  expect(birthdaysToday(localTime(new Date("2028-02-28T10:00:00Z"), "Africa/Tunis"))).toEqual(["02-28"])
  expect(birthdaysToday(localTime(new Date("2028-02-29T10:00:00Z"), "Africa/Tunis"))).toEqual(["02-29"])
})

test("quiet hours are 21:00 to 08:00", () => {
  expect([7, 8, 20, 21, 0].map(isQuietHour)).toEqual([true, false, false, true, true])
})
