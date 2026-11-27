import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { type Browser, type BrowserContext, type Download, expect, type Page, test } from "@playwright/test"
import { DEFAULT_DEMO_PASSWORD, DEMO_SUPER_ADMIN_EMAIL } from "@ritorno/common/demo"
import { signSurveyToken } from "@ritorno/common/survey"
import postgres from "postgres"
import { E2E_SECRET, e2eDatabaseUrl, URLS } from "../env"

/** One hotel, created through the admin UI, carried through every flow in the order a real hotel meets them. */
test.describe.configure({ mode: "serial" })

const PASSWORD = "correct horse battery"
const GUEST = "Nour Haddad"

let run: string
let hotel: { id: string; slug: string; name: string }
let owner: Page
let visitor: Page
let contexts: BrowserContext[]
let db: postgres.Sql
let links: { unsubscribe: string; offer: string }

/** Waits for the network to go quiet, so React has hydrated: input given before that is lost. */
async function open(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle" })
}

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext()
  contexts.push(context)
  return context.newPage()
}

async function signIn(page: Page, email: string, password: string) {
  await open(page, `${URLS.dashboard}/sign-in`)
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).not.toHaveURL(/sign-in/)
}

const guestId = async (name: string): Promise<string> => {
  const [row] = await db`select id from guests where hotel_id = ${hotel.id} and name = ${name}`
  expect(row, name).toBeTruthy()
  return row?.id
}

const consents = async (name: string): Promise<string[]> => {
  const rows = await db`
    select channel from guest_consents where guest_id = ${await guestId(name)} and granted order by channel`
  return rows.map((row) => row.channel)
}

async function downloaded(page: Page, trigger: () => Promise<void>): Promise<string> {
  const waiting: Promise<Download> = page.waitForEvent("download")
  await trigger()
  return readFile(await (await waiting).path(), "utf8")
}

test.beforeAll(async ({ browser }) => {
  run = Date.now().toString(36)
  hotel = { id: "", slug: `flows-${run}`, name: `Flows ${run}` }
  contexts = []
  db = postgres(e2eDatabaseUrl(), { max: 1, onnotice: () => {} })
  owner = await newPage(browser)
  visitor = await newPage(browser)
})

test.afterAll(async () => {
  await Promise.all(contexts.map((context) => context.close()))
  await db.end()
})

test("the super admin creates a hotel and its owner accepts the invitation", async ({ browser }) => {
  const admin = await newPage(browser)
  const email = `owner-${run}@example.com`
  await signIn(admin, DEMO_SUPER_ADMIN_EMAIL, DEFAULT_DEMO_PASSWORD)
  await open(admin, `${URLS.dashboard}/admin/hotels/new`)
  await admin.getByLabel("Hotel name").fill(hotel.name)
  await expect(admin.getByText(`${hotel.slug} is available.`)).toBeVisible()
  for (let step = 0; step < 3; step++) await admin.getByRole("button", { name: "Continue" }).click()
  await admin.getByLabel("Owner email").fill(email)
  await admin.getByRole("button", { name: "Create hotel and invite owner" }).click()
  await expect(admin).toHaveURL(/\/admin\/hotels\/(?!new)[^/]+$/)
  hotel.id = admin.url().split("/").pop() ?? ""

  const [invite] = await db`select id from invitation where organization_id = ${hotel.id}`
  // as from the email: the link leads to sign in, then sign up carries the invitation along
  await open(owner, `${URLS.dashboard}/accept-invitation/${invite?.id}`)
  await owner.getByRole("link", { name: "Create an account" }).click()
  await owner.getByLabel("Your name").fill("Olfa")
  await owner.getByLabel("Email").fill(email)
  await owner.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await owner.getByRole("button", { name: "Create account" }).click()
  await owner.getByRole("button", { name: "Accept invitation" }).click()
  await expect(owner).not.toHaveURL(/accept-invitation/)
})

test("new branding shows on the guest's capture page", async () => {
  await open(owner, `${URLS.dashboard}/hotel`)
  await owner.getByLabel("Hotel name").fill(`Maison ${run}`)
  await owner.getByRole("textbox", { name: "Primary color" }).last().fill("#7b2d8e")
  await owner.getByRole("button", { name: "Save", disabled: false }).click()
  await expect(owner.getByText("Saved", { exact: true }).first()).toBeVisible()

  await open(visitor, `${URLS.web}/h/${hotel.slug}?lang=en`)
  await expect(visitor.getByText(`Maison ${run}`).first()).toBeVisible()
  await expect(visitor.locator('[style*="#7b2d8e"]').first()).toBeAttached()
})

test("a welcome offer reaches a new guest and is redeemed once at the desk", async () => {
  // The welcome message comes from the job queue, polled below: it can take longer than the default test cap.
  test.slow()
  await open(owner, `${URLS.dashboard}/offers/new`)
  await owner.getByLabel("Title").fill("Welcome mint tea")
  await owner.getByLabel("Promo code").fill("TEA")
  await owner.getByLabel("Given automatically to").click()
  await owner.getByRole("option", { name: "New guests" }).click()
  await owner.getByRole("button", { name: "Create offer" }).click()
  await expect(owner).toHaveURL(/\/offers$/)

  await open(visitor, `${URLS.web}/h/${hotel.slug}?lang=en&src=room`)
  await visitor.getByLabel("Your name").fill(GUEST)
  await visitor.locator("#capture-phone").fill("98 111 222")
  await visitor.locator("input[name=emailConsent]").check({ force: true })
  await visitor.locator("#capture-email").fill(`nour-${run}@example.com`)
  await visitor.getByRole("button", { name: "Join" }).click()
  await expect(visitor.getByRole("heading", { name: "You are in, Nour" })).toBeVisible()

  let welcome = ""
  await expect
    .poll(
      async () => {
        const [message] = await db`
          select preview from messages
          where hotel_id = ${hotel.id} and template_key = 'welcome' and channel = 'email'`
        welcome = JSON.stringify(message?.preview ?? "")
        return welcome
      },
      { timeout: 30_000 },
    )
    .toContain("/o/")
  const link = (kind: "o" | "u") => welcome.match(new RegExp(`${URLS.web}(?:/(?:fr|ar))?/${kind}/[\\w.-]+`))?.[0] ?? ""
  links = { offer: link("o"), unsubscribe: link("u") }

  await open(visitor, links.offer)
  await expect(visitor.getByText("Welcome mint tea")).toBeVisible()
  const [issued] = await db`select code from offer_codes where hotel_id = ${hotel.id}`

  await open(owner, `${URLS.dashboard}/redeem`)
  await owner.locator("#redeem-code").fill(issued?.code)
  await owner.getByRole("button", { name: "Check" }).click()
  await owner.getByRole("button", { name: "Mark as redeemed" }).click()
  await expect(owner.getByText("Redeemed. Thank you!").first()).toBeVisible()
  await owner.getByRole("button", { name: "Next code" }).click()
  await owner.locator("#redeem-code").fill(issued?.code)
  await owner.getByRole("button", { name: "Check" }).click()
  await expect(owner.getByText("Already redeemed")).toBeVisible()
})

test("the unsubscribe link in the welcome email stops every message", async () => {
  expect(await consents(GUEST)).toEqual(["email"])
  await open(visitor, links.unsubscribe)
  await visitor.getByRole("button", { name: "Unsubscribe from everything" }).click()
  await expect(visitor.getByText("You are unsubscribed")).toBeVisible()
  await expect.poll(() => consents(GUEST)).toEqual([])
  const [logged] = await db`
    select channel, granted, source from consent_events
    where guest_id = ${await guestId(GUEST)} order by at desc limit 1`
  expect(logged).toEqual({ channel: "email", granted: false, source: "unsubscribe_link" })
})

test("an unhappy survey answer opens a case the hotel can follow up", async () => {
  const inviteId = randomUUID()
  // The survey job runs hourly and a day after the stay, so the invite is written directly.
  await db`
    insert into survey_invites (id, hotel_id, guest_id, sent_at, expires_at)
    values (${inviteId}, ${hotel.id}, ${await guestId(GUEST)}, now(), now() + interval '1 day')`
  const token = signSurveyToken(E2E_SECRET, "survey", { hotelId: hotel.id, inviteId })

  await open(visitor, `${URLS.web}/s/${token}?lang=en`)
  await visitor
    .locator("label")
    .filter({ has: visitor.locator('input[name=nps][value="2"]') })
    .click()
  await visitor.getByLabel("Anything you want to tell us?").fill("The shower was cold")
  await visitor.getByRole("button", { name: "Send my answer" }).click()
  await expect(visitor.getByRole("heading", { name: "Thank you" })).toBeVisible()

  await open(owner, `${URLS.dashboard}/feedback`)
  await expect(owner.getByText("The shower was cold").filter({ visible: true })).toBeVisible()
})

test("a CSV import adds guests and records consent only where the file says yes", async () => {
  await open(owner, `${URLS.dashboard}/guests/import`)
  const csv =
    "name,phone,email,language,consent\nSalma Trabelsi,+216 98 333 444,,fr,yes\nKarim Jlassi,+216 98 555 666,,en,no\n"
  await owner
    .locator("#import-file")
    .setInputFiles({ name: "guests.csv", mimeType: "text/csv", buffer: Buffer.from(csv) })
  await owner.getByRole("button", { name: "Continue" }).click()
  await owner.getByRole("checkbox", { name: /I confirm our hotel/ }).click()
  await owner.getByRole("button", { name: "Import 2 guests" }).click()
  await expect(owner.getByText("Import finished")).toBeVisible()
  expect(await consents("Salma Trabelsi")).toEqual(["whatsapp"])
  expect(await consents("Karim Jlassi")).toEqual([])
})

test("one guest, then every guest, can be exported and deleted", async () => {
  const count = async () => (await db`select count(*)::int as n from guests where hotel_id = ${hotel.id}`)[0]?.n
  await open(owner, `${URLS.dashboard}/guests/${await guestId("Karim Jlassi")}`)
  await owner.getByRole("button", { name: "More actions" }).click()
  const one = await downloaded(owner, () => owner.getByRole("menuitem", { name: "As CSV" }).click())
  expect(one).toContain("Karim Jlassi")
  expect(one).not.toContain("Salma")
  await owner.getByRole("button", { name: "More actions" }).click()
  await owner.getByRole("menuitem", { name: "Delete" }).click()
  await owner.getByLabel("Type Karim Jlassi to confirm").fill("Karim Jlassi")
  await owner.getByRole("button", { name: "Delete permanently" }).click()
  await expect.poll(count).toBe(2)

  await open(owner, `${URLS.dashboard}/data`)
  const all = await downloaded(owner, () => owner.getByRole("button", { name: "Export CSV" }).click())
  expect(all).toContain("Salma Trabelsi")
  expect(all).toContain(GUEST)
  expect(all).not.toContain("Karim")
  await owner.getByRole("button", { name: "Delete all guests" }).click()
  await owner.getByRole("alertdialog").getByRole("textbox").fill(`Maison ${run}`)
  await owner.getByRole("button", { name: "Delete permanently" }).click()
  await expect.poll(count).toBe(0)
})
