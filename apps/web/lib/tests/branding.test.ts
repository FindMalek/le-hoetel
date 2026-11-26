import { describe, expect, test } from "bun:test"
import { guestBrand } from "../branding"

describe("guestBrand", () => {
  test("keeps the ink focus ring when the hotel color is too faint on white", () => {
    expect(guestBrand({ primaryColor: "#1f6f8b", accentColor: null })).toMatchObject({ "--ring": "#1f6f8b" })
    expect(guestBrand({ primaryColor: "#f2c94c", accentColor: null })).not.toHaveProperty("--ring")
  })
})
