import { expect, test } from "bun:test"
import { HOLIDAY_KEYS, HOLIDAYS, holidaysOn, ISLAMIC_DATES, ISLAMIC_DATES_UNTIL, nextHolidayDate } from "../holidays"

test("fixed and islamic holidays are found by date, and two can share a day", () => {
  expect(holidaysOn("2026-07-25")).toEqual(["republic_day"])
  expect(holidaysOn("2026-02-18")).toEqual(["ramadan_start"])
  expect(holidaysOn("2026-03-20")).toEqual(["eid_al_fitr", "independence_day"])
  expect(holidaysOn("2026-03-21")).toEqual([])
})

test("every holiday has a name and a body in en, fr and ar", () => {
  for (const key of HOLIDAY_KEYS) {
    for (const language of ["en", "fr", "ar"] as const) {
      const { name, body } = HOLIDAYS[key].text[language]
      expect(name.length).toBeGreaterThan(0)
      expect(body).toContain("{hotel}")
    }
  }
})

test("the static islamic table reaches at least five years ahead and stays sorted", () => {
  expect(ISLAMIC_DATES_UNTIL).toBeGreaterThanOrEqual(new Date().getFullYear() + 5)
  for (const dates of Object.values(ISLAMIC_DATES)) expect([...dates].sort()).toEqual(dates)
})

test("the next date rolls over to next year and skips the past", () => {
  expect(nextHolidayDate("new_year", "2026-11-25")).toBe("2027-01-01")
  expect(nextHolidayDate("independence_day", "2026-03-20")).toBe("2026-03-20")
  expect(nextHolidayDate("eid_al_adha", "2026-06-01")).toBe("2027-05-16")
  expect(nextHolidayDate("mawlid", "2035-06-01")).toBeNull()
})
