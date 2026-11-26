import { expect, test } from "bun:test"
import { isStopKeyword, signUnsubscribeToken, verifyUnsubscribeToken } from "../unsubscribe"

const subject = { hotelId: "hotel_1", guestId: "0b3c3a52-7c4e-4a43-9f4e-1a1d6b0f6f10", channel: "email" } as const

test("a token only verifies for the server that signed it, and any edit breaks it", () => {
  const token = signUnsubscribeToken("secret-one", subject)
  expect(verifyUnsubscribeToken("secret-one", token)).toEqual(subject)
  expect(verifyUnsubscribeToken("secret-two", token)).toBeNull()
  const [body, signature] = token.split(".")
  const other = Buffer.from("v1|hotel_2|x|email").toString("base64url")
  expect(verifyUnsubscribeToken("secret-one", `${other}.${signature}`)).toBeNull()
  expect(verifyUnsubscribeToken("secret-one", `${body}.`)).toBeNull()
  expect(verifyUnsubscribeToken("secret-one", "garbage")).toBeNull()
})

test("STOP is recognised in en, fr and ar, only as the whole message", () => {
  for (const word of ["STOP", " stop. ", "Arrêt", "arreter !", "إيقاف", "إلغاء الاشتراك", "Unsubscribe"]) {
    expect(isStopKeyword(word)).toBe(true)
  }
  for (const text of ["don't stop the music", "stop the booking please", "merci", ""]) {
    expect(isStopKeyword(text)).toBe(false)
  }
})
