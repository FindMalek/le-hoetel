import { expect, test } from "bun:test"
import { CONSENT_CHANNELS, CONSENT_WORDING, consentWording } from "./consent"
import { HOTEL_LANGUAGES } from "./hotel"

test("every channel has wording in every language and the hotel name is filled in", () => {
  for (const channel of CONSENT_CHANNELS) {
    for (const language of HOTEL_LANGUAGES) {
      expect(CONSENT_WORDING[channel][language]).toContain("{hotel}")
      expect(consentWording(channel, language, "Le Palais")).toContain("Le Palais")
    }
  }
})
