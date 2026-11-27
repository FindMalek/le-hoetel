import { expect, test } from "bun:test"
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { config } from "../proxy"

test("a guest link with a signed token reaches the proxy in every language", () => {
  for (const prefix of ["", "/fr", "/ar"]) {
    expect(unstable_doesMiddlewareMatch({ config, url: `${prefix}/o/payload.signature` })).toBe(true)
  }
})
