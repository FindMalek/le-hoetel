import { expect, test } from "bun:test"
import { getCountries, getCountryCallingCode } from "libphonenumber-js/min"
import {
  countryFromLocales,
  DIAL_COUNTRIES,
  matchesCountry,
  phoneSearchDigits,
  readPhone,
  toInternational,
} from "../dial"
import { parsePhone, settleCountry } from "../phone"

const read = (input: string, country = "TN") => readPhone(input, { country, national: "" })
const sent = (input: string, country = "TN") => parsePhone(toInternational(read(input, country)))?.e164

test("a pasted international number switches the country instead of getting the selected code", () => {
  expect(read("+33 6 12 34 56 78")).toEqual({ country: "FR", national: "6 12 34 56 78" })
  expect(sent("+33 6 12 34 56 78")).toBe("+33612345678")
  expect(sent("0033 6 12 34 56 78")).toBe("+33612345678")
  expect(sent("+971 (0) 50 123 4567")).toBe("+971501234567")
  expect(sent("‏+٣٣ ٦ ١٢ ٣٤ ٥٦ ٧٨")).toBe("+33612345678")
  expect(read("+1 416 555 0199", "CA").country).toBe("CA")
})

test("typing a code one key at a time keeps the text until it names a country", () => {
  let value = { country: "TN", national: "" }
  for (const key of "+351") value = readPhone(value.national + key, value)
  expect(value).toEqual({ country: "PT", national: "" })
  expect(toInternational(read("+999 123456"))).toBe("+999 123456")
})

test("a national number keeps or loses its zero as the country needs", () => {
  expect(sent("06 12 34 56 78", "FR")).toBe("+33612345678")
  expect(sent("06 6982 1234", "IT")).toBe("+390669821234")
  expect(sent("020 123 456", "TN")).toBe("+21620123456")
})

test("every country libphonenumber knows can be picked, with its code", () => {
  const ours = DIAL_COUNTRIES.map((item) => `${item.country}${item.code}`).sort()
  expect(ours).toEqual(
    getCountries()
      .map((country) => `${country}${getCountryCallingCode(country)}`)
      .sort(),
  )
})

test("the browser locale preselects only when it names a region", () => {
  expect(countryFromLocales(["fr", "fr-BE"])).toBe("BE")
  expect(countryFromLocales(["zh-Hant-TW"])).toBe("TW")
  expect(countryFromLocales(["ar", "en"])).toBeNull()
})

test("country search ignores accents and hamza and takes a calling code", () => {
  const us = { country: "US", code: "1", names: ["États-Unis", "United States"] }
  const ae = { country: "AE", code: "971", names: ["الإمارات العربية المتحدة"] }
  expect(matchesCountry(us, "etats")).toBe(true)
  expect(matchesCountry(ae, "الامارات")).toBe(true)
  expect(matchesCountry(ae, "+97")).toBe(true)
  expect(matchesCountry(ae, "france")).toBe(false)
})

test("local and 00 spellings search the stored number", () => {
  for (const query of ["06 12 34 56 78", "0033 612345678", "٠٦١٢٣٤٥٦٧٨"]) {
    expect("+33612345678").toContain(phoneSearchDigits(query))
  }
})

test("a local number under a guessed country becomes Tunisian, a chosen country is left alone", () => {
  const guessed = { country: "US", national: "98 765 432", detected: "US" }
  const settled = settleCountry(guessed)
  expect(settled.country).toBe("TN")
  // more digits make it a real US number again
  expect(settleCountry({ ...settled, national: "415 555 2671" }).country).toBe("US")
  expect(settleCountry({ country: "FR", national: "98 765 432" }).country).toBe("FR")
  expect(settleCountry(readPhone("+33 98 765 432", guessed))).toEqual({ country: "FR", national: "98 765 432" })
})
