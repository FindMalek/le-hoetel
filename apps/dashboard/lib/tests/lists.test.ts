import { afterEach, expect, spyOn, test } from "bun:test"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { createORPCClientUtils } from "@ritorno/orpc/client"
import { QueryClient } from "@tanstack/react-query"
import { guestsList } from "../lists"

const network = spyOn(globalThis, "fetch")
afterEach(() => network.mockReset())

test("a list asks the api for the hotel it is keyed by", async () => {
  const sent: (string | null)[] = []
  network.mockImplementation((async (request: Request) => {
    sent.push(request.headers.get("x-hotel-id"))
    return Response.json({ json: { items: [], total: 0, nextCursor: null } })
  }) as unknown as typeof fetch)
  const { client } = createORPCClientUtils({ url: "http://api.test/rpc" })
  const options = guestsList(createTanstackQueryUtils(client), "hotel-a", {})

  await new QueryClient().fetchInfiniteQuery(options)

  expect(options.queryKey.at(-1) as unknown).toBe("hotel-a")
  expect(sent).toEqual(["hotel-a"])
})
