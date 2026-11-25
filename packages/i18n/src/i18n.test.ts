import { expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { alternateUrls, getDirection, htmlAttributes, localizedPath, negotiateLocale, splitLocale } from "./config"
import { getMessages, withFallback } from "./index"
import { localeProxy } from "./proxy"

test("a locale prefix is split off and put back, the default locale has none", () => {
  expect(splitLocale("/fr/roadmap")).toEqual({ locale: "fr", pathname: "/roadmap" })
  expect(splitLocale("/frog")).toEqual({ locale: null, pathname: "/frog" })
  expect(localizedPath("fr", "/")).toBe("/fr")
  expect(localizedPath("fr", "/en/roadmap")).toBe("/fr/roadmap")
  expect(localizedPath("en", "/fr/roadmap")).toBe("/roadmap")
})

test("accept-language picks the best supported language", () => {
  expect(negotiateLocale("de,fr-CA;q=0.9,en;q=0.5")).toBe("fr")
  expect(negotiateLocale("de")).toBe("en")
})

test("hreflang alternates point at one url per language", () => {
  expect(alternateUrls("https://le-hoetel.dev", "/roadmap")).toEqual({
    en: "https://le-hoetel.dev/roadmap",
    fr: "https://le-hoetel.dev/fr/roadmap",
    ar: "https://le-hoetel.dev/ar/roadmap",
    "x-default": "https://le-hoetel.dev/roadmap",
  })
})

test("the proxy serves /fr from the same page and sends a returning french visitor there", () => {
  const prefixed = localeProxy(new NextRequest("http://localhost:3000/fr/roadmap"))
  expect(prefixed.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/roadmap")
  expect(prefixed.headers.get("x-middleware-request-x-locale")).toBe("fr")

  const returning = localeProxy(
    new NextRequest("http://localhost:3000/roadmap?x=1", { headers: { cookie: "NEXT_LOCALE=fr" } }),
  )
  expect(returning.headers.get("location")).toBe("http://localhost:3000/fr/roadmap?x=1")

  const english = localeProxy(new NextRequest("http://localhost:3000/en/roadmap"))
  expect(english.headers.get("location")).toBe("http://localhost:3000/roadmap")
  expect(english.cookies.get("NEXT_LOCALE")?.value).toBe("en")
})

test("arabic is right to left and the rest are left to right", () => {
  expect(getDirection("ar")).toBe("rtl")
  expect(htmlAttributes("ar")).toEqual({ lang: "ar", dir: "rtl" })
  expect(htmlAttributes("fr")).toEqual({ lang: "fr", dir: "ltr" })
  expect(negotiateLocale("ar-TN,ar;q=0.9,en;q=0.5")).toBe("ar")
})

test("a key missing from a translation falls back to english", () => {
  const en = { a: "Hello", nested: { b: "Bye", c: "Thanks" } }
  expect(withFallback(en, { nested: { b: "Au revoir" } })).toEqual({
    a: "Hello",
    nested: { b: "Au revoir", c: "Thanks" },
  })
  expect(getMessages("ar").landing.hero.demo).not.toBe(getMessages("en").landing.hero.demo)
})
