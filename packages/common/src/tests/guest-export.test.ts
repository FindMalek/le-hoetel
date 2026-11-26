import { expect, test } from "bun:test"
import { guestsToCsv } from "../guest-export"
import type { Guest } from "../schemas"

const guest: Guest = {
  id: "0b3c3a52-7c4e-4a43-9f4e-1a1d6b0f6f10",
  name: '=HYPERLINK("http://evil.test")',
  phoneE164: "+21620123456",
  language: "fr",
  email: "a,b@example.test",
  birthday: null,
  source: "qr_room",
  country: null,
  city: null,
  stayCheckIn: null,
  stayCheckOut: null,
  nextDestination: null,
  consents: { email: true, whatsapp: false, profile: false },
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-01T10:00:00Z"),
}

test("csv quotes commas, neutralises formulas and folds the consent log into the last column", () => {
  const csv = guestsToCsv([
    {
      guest,
      consentEvents: [
        {
          channel: "email",
          granted: true,
          source: "qr_room",
          wordingVersion: "v1",
          at: new Date("2026-11-01T10:00:00Z"),
        },
      ],
    },
  ])
  const [header, row] = csv.split("\r\n")
  expect(header?.split(",")).toHaveLength(16)
  expect(row).toStartWith(`"'=HYPERLINK(""http://evil.test"")",+21620123456,fr,`)
  expect(row).toContain('"a,b@example.test"')
  expect(row).toEndWith("2026-11-01T10:00:00.000Z email granted qr_room v1")
})
