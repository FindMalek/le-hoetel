import { expect, test } from "bun:test"
import { htmlAttributes } from "@ritorno/i18n/config"
import { CTA_URL, HOTEL, renderMatrix, UNSUBSCRIBE_URL } from "../../tests/matrix"
import { COPY } from "../copy"
import { renderEmail } from "../render"

const matrix = await renderMatrix()
const hotelEmails = matrix.filter((email) => email.kind === "hotel")

const strings = (value: object, path = ""): [string, string][] =>
  Object.entries(value).flatMap(([key, item]) =>
    typeof item === "string" ? [[`${path}${key}`, item]] : strings(item, `${path}${key}.`),
  )

// Subject and text only, so a copy change reads as a copy change. Markup is checked by the assertions below.
test("subject and text of every hotel email", () => {
  for (const { name, locale, subject, text } of hotelEmails) {
    expect({ subject, text }).toMatchSnapshot(`${name} ${locale}`)
  }
})

test("no french or arabic string is left in english", () => {
  const english = new Map(strings(COPY.en))
  for (const locale of ["fr", "ar"] as const) {
    expect(strings(COPY[locale]).filter(([key, value]) => !value.trim() || value === english.get(key))).toEqual([])
  }
})

test("arabic emails carry no latin words beyond the hotel's own data", () => {
  for (const { name, subject, text } of hotelEmails.filter((email) => email.locale === "ar")) {
    const words = [HOTEL.name, HOTEL.address, UNSUBSCRIBE_URL, CTA_URL, "WELCOME"]
      .reduce((rest, data) => rest.replaceAll(data, "").replaceAll(data.toUpperCase(), ""), `${subject}\n${text}`)
      .match(/[A-Za-z]{2,}/g)
    expect({ name, words }).toEqual({ name, words: null })
  }
})

test("every hotel email has its direction, the hotel's branding and a working unsubscribe link", () => {
  for (const { name, locale, subject, html, text } of hotelEmails) {
    const { lang, dir } = htmlAttributes(locale)
    expect({ name, locale, leaked: /undefined|\[object|\{\w+\}|NaN/.test(`${subject}${html}${text}`) }).toEqual({
      name,
      locale,
      leaked: false,
    })
    expect(html).toMatch(new RegExp(`<html[^>]*dir="${dir}"[^>]*lang="${lang}"`))
    expect(html).toContain(`href="${UNSUBSCRIBE_URL}"`)
    expect(html).toContain(COPY[locale].common.unsubscribe)
    expect(text).toContain(UNSUBSCRIBE_URL)
    expect(html).toContain(`src="${HOTEL.logoUrl}"`)
    expect(html).toContain(`alt="${HOTEL.name}"`)
    expect(html).toContain(`background-color:${HOTEL.primaryColor}`)
    expect(html).toContain(`background-color:${HOTEL.accentColor}`)
    expect(html).toContain(`.e-ob { border-color: ${HOTEL.accentColor}`)
  }
})

test("the ritorno footer of manager emails is translated", () => {
  for (const { locale, text } of matrix.filter((email) => email.name === "alert" && email.locale !== "en")) {
    expect({ locale, english: text.includes("Sent by") }).toEqual({ locale, english: false })
  }
})

test("hotel and guest text in another direction is isolated in arabic", async () => {
  const email = await renderEmail("message", {
    hotel: HOTEL,
    guest: { name: "Sara", unsubscribeUrl: UNSUBSCRIBE_URL },
    locale: "ar",
    props: {
      subject: "News",
      title: "Big news!",
      body: "Pool is open.",
      offer: { title: "Free tea." },
      ctaUrl: CTA_URL,
      ctaLabel: "Book now!",
    },
  })
  const alert = matrix.find((item) => item.name === "alert" && item.locale === "ar")
  for (const text of ["Big news!", "Pool is open.", "Free tea.", "Book now!"])
    expect(email.html).toContain(`\u2068${text}\u2069`)
  expect(alert?.html).toContain("\u2068The room was noisy.\u2069")
})

test("a faint brand color keeps a readable button and a missing address leaves no placeholder", async () => {
  const email = await renderEmail("survey", {
    hotel: { name: "Dar", primaryColor: "#ffff00" },
    guest: { name: "Sara", unsubscribeUrl: UNSUBSCRIBE_URL },
    locale: "en",
    props: { ctaUrl: CTA_URL },
  })
  expect(email.html).toContain("background-color:#ffff00")
  expect(email.html).toMatch(/color:#000000/)
  expect(email.text).not.toContain("·")
})
