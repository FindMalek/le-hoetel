import { expect, test } from "bun:test"
import { LOCALES } from "@le-hoetel/i18n/config"
import { renderEmail } from "./render"
import type { EmailHotel, EmailOffer, EmailProps, HotelEmailKey } from "./types"

const hotel: EmailHotel = {
  name: "Hôtel Dar Zitouna",
  logoUrl: "https://cdn.test/logo.png",
  primaryColor: "#0f766e",
  accentColor: "#f59e0b",
  address: "12 Rue de la Médina, Tunis",
}
const guest = { name: "Sara", unsubscribeUrl: "https://hoetel.test/u/token" }
const offer: EmailOffer = { title: "Free breakfast", description: "For two", validUntil: "2026-12-31", code: "DAR-24" }
const ctaUrl = "https://hoetel.test/o/1"

const PROPS: { [Key in HotelEmailKey]: EmailProps[Key] } = {
  welcome: { offer, ctaUrl },
  birthday: { offer, ctaUrl },
  survey: { ctaUrl },
  reminder: { offer, ctaUrl },
}

for (const key of Object.keys(PROPS) as HotelEmailKey[]) {
  for (const locale of LOCALES) {
    test(`${key} in ${locale} renders html, text and subject`, async () => {
      const email = await renderEmail(key, { hotel, guest, locale, props: PROPS[key] as never })
      expect(email).toMatchSnapshot()
      expect(`${email.subject}${email.html}${email.text}`).not.toMatch(/undefined|\[object|\{\w+\}|NaN/)
    })
  }
}

test("arabic is right to left, the brand button reads, unsubscribe is in both parts", async () => {
  const dark = { ...hotel, primaryColor: "#ffff00", logoUrl: null, address: null }
  const email = await renderEmail("survey", { hotel: dark, guest, locale: "ar", props: { ctaUrl } })
  expect(email.html).toContain('dir="rtl"')
  expect(email.html).toContain("background-color:#ffff00")
  expect(email.html).toMatch(/color:#000000/)
  expect(email.html).toContain("عنوان الفندق")
  expect(email.html).toContain(guest.unsubscribeUrl)
  expect(email.text).toContain(guest.unsubscribeUrl)
})
