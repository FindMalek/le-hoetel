import { expect, test } from "bun:test"
import { scrubEvent } from "../sentry"

test("an error report loses the query params and any phone or email before it leaves", () => {
  const event = scrubEvent({
    type: undefined,
    exception: {
      values: [
        { type: "Error", value: 'Failed query: insert into "guests"\nparams: hotel-1,Amel Ben Salah,+21620123456' },
        { type: "PostgresError", value: "Key (hotel_id, phone_e164)=(hotel-1, +216 20 123 456) already exists." },
      ],
    },
    extra: { guest: { phone: "+21620123456", email: "amel@example.test" } },
  })

  const sent = JSON.stringify(event)
  expect(sent).toContain('Failed query: insert into \\"guests\\"')
  expect(sent).not.toContain("Amel")
  expect(sent).not.toContain("123")
})
