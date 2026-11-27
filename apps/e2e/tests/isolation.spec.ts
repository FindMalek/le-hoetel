import { type APIRequestContext, expect, test } from "@playwright/test"
import { INVITATION_ID_HEADER } from "@ritorno/common/constants"
import { DEFAULT_DEMO_PASSWORD, DEMO_SUPER_ADMIN_EMAIL } from "@ritorno/common/demo"
import postgres from "postgres"
import { e2eDatabaseUrl, URLS } from "../env"

const PASSWORD = "correct horse battery"
const run = Date.now()

type Jar = Map<string, string>

const cookieHeader = (jar: Jar) => [...jar.values()].join("; ")

function remember(jar: Jar, response: { headersArray: () => { name: string; value: string }[] }) {
  for (const { name, value } of response.headersArray()) {
    if (name.toLowerCase() !== "set-cookie") continue
    const pair = value.split(";")[0] ?? ""
    jar.set(pair.split("=")[0] ?? "", pair)
  }
}

async function signUp(request: APIRequestContext, email: string, invitationId: string) {
  const response = await request.post(`${URLS.api}/auth/sign-up/email`, {
    headers: { origin: URLS.dashboard, [INVITATION_ID_HEADER]: invitationId },
    data: { email, password: PASSWORD, name: email.split("@")[0] },
  })
  expect(response.status()).toBe(200)
  return response
}

const call = (
  request: APIRequestContext,
  jar: Jar,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  data?: unknown,
) =>
  request[method](`${URLS.api}/v1${path}`, {
    headers: { cookie: cookieHeader(jar), "x-csrf-token": "orpc" },
    data,
  })

const guest = (phone: string, name: string) => ({
  name,
  phone,
  language: "fr",
  email: `${name.toLowerCase()}-${run}@example.com`,
  source: "staff",
  consents: { email: true, whatsapp: true, profile: false },
})

test("one hotel can never read, change, export or delete another hotel's guests over http", async ({ request }) => {
  const admin: { jar: Jar } = { jar: new Map() }
  const login = await request.post(`${URLS.api}/auth/sign-in/email`, {
    headers: { origin: URLS.dashboard },
    data: { email: DEMO_SUPER_ADMIN_EMAIL, password: DEFAULT_DEMO_PASSWORD },
  })
  expect(login.status()).toBe(200)
  remember(admin.jar, login)
  // Sign up is by invitation only: each owner signs up once their hotel's invitation exists.
  const ownerA = { email: `iso-owner-a-${run}@example.com`, jar: new Map() as Jar }
  const ownerB = { email: `iso-owner-b-${run}@example.com`, jar: new Map() as Jar }

  const hotels: Record<string, string> = {}
  for (const [key, owner] of [
    ["a", ownerA],
    ["b", ownerB],
  ] as const) {
    const created = await call(request, admin.jar, "post", "/admin/hotels", {
      name: `Hotel ${key} ${run}`,
      slug: `iso-${key}-${run}`,
      ownerEmail: owner.email,
    })
    expect(created.status()).toBe(200)
    hotels[key] = (await created.json()).id
    const db = postgres(e2eDatabaseUrl(), { max: 1, onnotice: () => {} })
    const [invite] = await db`select id from invitation where organization_id = ${String(hotels[key])}`
    await db.end()
    remember(owner.jar, await signUp(request, owner.email, String(invite?.id)))
    const accepted = await request.post(`${URLS.api}/auth/organization/accept-invitation`, {
      headers: { origin: URLS.dashboard, cookie: cookieHeader(owner.jar) },
      data: { invitationId: invite?.id },
    })
    expect(accepted.status()).toBe(200)
    const active = await request.post(`${URLS.api}/auth/organization/set-active`, {
      headers: { origin: URLS.dashboard, cookie: cookieHeader(owner.jar) },
      data: { organizationId: hotels[key] },
    })
    expect(active.status()).toBe(200)
    remember(owner.jar, active)
  }

  const createdA = await call(request, ownerA.jar, "post", "/guests", guest("20 111 111", "Alice"))
  const createdB = await call(request, ownerB.jar, "post", "/guests", guest("20 222 222", "Bob"))
  expect(createdA.status()).toBe(200)
  expect(createdB.status()).toBe(200)
  const bobId: string = (await createdB.json()).id

  for (const [method, path, data] of [
    ["get", `/guests/${bobId}`],
    ["patch", `/guests/${bobId}`, { name: "Hacked" }],
    ["get", `/guests/${bobId}/export`],
    ["get", `/guests/${bobId}/consent-events`],
    ["get", `/guests/${bobId}/activity`],
    ["delete", `/guests/${bobId}`],
  ] as const) {
    const response = await call(request, ownerA.jar, method, path, data)
    expect(response.status(), `${method} ${path}`).toBe(404)
  }

  const listed = await call(request, ownerA.jar, "get", "/guests")
  expect((await listed.json()).items.map((item: { name: string }) => item.name)).toEqual(["Alice"])
  const exported = await call(request, ownerA.jar, "get", "/guests/export")
  expect(JSON.stringify(await exported.json())).not.toContain("+21620222222")

  const stillThere = await call(request, ownerB.jar, "get", `/guests/${bobId}`)
  expect(stillThere.status()).toBe(200)
  expect((await stillThere.json()).name).toBe("Bob")

  const aimed = await request.get(`${URLS.api}/v1/guests`, {
    headers: { cookie: cookieHeader(ownerA.jar), "x-csrf-token": "orpc", "x-hotel-id": hotels.b ?? "" },
  })
  expect(aimed.status()).toBe(403)
})
