import { expect, test } from "bun:test"
import { parsePhone } from "@ritorno/common/phone"
import { buildHotelScenario } from "../hotels"

const now = new Date("2026-11-24T10:00:00Z")
const s = buildHotelScenario(now, "hash")

test("same seed, same hotels and guests", () => {
  expect(buildHotelScenario(now, "hash")).toEqual(s)
})

test("four hotels, hundreds of guests, every phone valid and unique per hotel", () => {
  expect(s.organizations.map((o) => o.slug)).toEqual(["dar-zitouna", "sunset-bay", "villa-mimosa", "riad-dattier"])
  expect(s.guests.length).toBeGreaterThan(300)
  expect(s.guests.every((g) => parsePhone(g.phoneE164)?.e164 === g.phoneE164)).toBe(true)
  expect(new Set(s.guests.map((g) => `${g.hotelId}${g.phoneE164}`)).size).toBe(s.guests.length)
})

test("covers fr, ar and en guests and accounts on the demo domain", () => {
  expect(new Set(s.guests.map((g) => g.language))).toEqual(new Set(["fr", "ar", "en"]))
  expect(s.users.every((u) => u.email.endsWith("@demo.ritorno.test"))).toBe(true)
  expect(s.users.find((u) => u.role === "admin")).toBeDefined()
})

test("current consent matches the last event, optional details only with profile consent", () => {
  for (const c of s.guestConsents) {
    const last = s.consentEvents.filter((e) => e.guestId === c.guestId && e.channel === c.channel).at(-1)
    expect(last?.granted).toBe(c.granted)
  }
  const profileGranted = new Set(
    s.guestConsents.filter((c) => c.channel === "profile" && c.granted).map((c) => c.guestId),
  )
  for (const g of s.guests)
    if (!profileGranted.has(g.id!)) expect(g.country ?? g.city ?? g.stayCheckIn ?? g.nextDestination).toBeNull()
  expect(s.consentEvents.some((e) => !e.granted)).toBe(true)
})
