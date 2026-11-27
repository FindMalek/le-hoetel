import { type Browser, devices, expect, type Locator, type Page, test } from "@playwright/test"
import { DEFAULT_DEMO_PASSWORD, demoOwnerEmail } from "@ritorno/common/demo"
import postgres from "postgres"
import { guideDatabaseUrl, URLS } from "./env"
import { capture, frame, shot } from "./frame"

/** The screenshots of the hotel staff guide (apps/docs/content/docs/guide), one test per page of it. */

const HOTEL = "demo-hotel-sunset-bay"
const OWNER = demoOwnerEmail("sunset-bay")
const MANAGER = "manager.sunset-bay@demo.ritorno.test"
const STAFF = "reception.sunset-bay@demo.ritorno.test"

const DESKTOP = { viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1.5 }
const PHONE = {
  ...devices["iPhone 14"],
  defaultBrowserType: "chromium" as const,
  viewport: { width: 390, height: 760 },
  deviceScaleFactor: 2,
}

async function open(page: Page, path: string, base = URLS.dashboard): Promise<void> {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" })
}

/** A page of its own context, cookie card answered, signed in when an email is given. */
async function visit(browser: Browser, email?: string, device: object = DESKTOP): Promise<Page> {
  const context = await browser.newContext({ ...device, locale: "en-GB", timezoneId: "Africa/Tunis" })
  const page = await context.newPage()
  await open(page, "/sign-in")
  await page.getByRole("button", { name: "Decline" }).click()
  if (!email) return page
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(DEFAULT_DEMO_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).not.toHaveURL(/sign-in/)
  await page.waitForLoadState("networkidle")
  return page
}

const main = (page: Page): Locator => page.locator("main")
/** Links styled as buttons report either role. */
const act = (page: Page, name: string | RegExp): Locator =>
  page
    .getByRole("button", { name, exact: true })
    .or(page.getByRole("link", { name, exact: true }))
    .filter({ visible: true })
    .first()
const text = (page: Page, value: string | RegExp): Locator =>
  main(page).getByText(value, { exact: true }).filter({ visible: true }).first()
const heading = (page: Page, name: string | RegExp): Locator => page.getByRole("heading", { name }).first()
const tall = (page: Page, height: number) => page.setViewportSize({ width: 1200, height })

let db: postgres.Sql
test.beforeAll(() => {
  db = postgres(guideDatabaseUrl(), { max: 1, onnotice: () => {} })
})
test.afterAll(async () => {
  await db.end()
})

/** A guest who agreed to everything, stayed and answered the survey: the profile with the most to show. */
async function richGuest(): Promise<{ id: string; name: string; phone: string }> {
  const [row] = await db<{ id: string; name: string; phone: string }[]>`
    select g.id, g.name, g.phone_e164 as phone from guests g
    where g.hotel_id = ${HOTEL} and g.email is not null and g.name ~ '^[A-Z]'
      and (select count(*) from guest_consents c where c.guest_id = g.id and c.granted) = 3
      and exists (select 1 from survey_responses r where r.guest_id = g.id)
    order by g.created_at desc, g.id limit 1`
  return row!
}

async function readyCode(): Promise<string> {
  const [row] = await db<{ code: string }[]>`
    select c.code from offer_codes c join offers o on o.id = c.offer_id
    where c.hotel_id = ${HOTEL} and o.active and (o.valid_until is null or o.valid_until > now())
      and not exists (select 1 from offer_redemptions r where r.offer_id = c.offer_id and r.guest_id = c.guest_id)
    order by c.code limit 1`
  return row!.code
}

async function campaignId(status: string): Promise<string> {
  const [row] = await db<{ id: string }[]>`
    select id from campaigns where hotel_id = ${HOTEL} and status = ${status} order by created_at desc limit 1`
  return row!.id
}

test("first day", async ({ browser }) => {
  const visitor = await visit(browser)
  await shot(
    visitor,
    "sign-in",
    [
      [visitor.getByLabel("Email"), "left"],
      [visitor.getByLabel("Password", { exact: true }), "left"],
      [act(visitor, "Sign in"), "left"],
      [act(visitor, "Forgot password?"), "right"],
      [act(visitor, "Create an account"), "right"],
    ],
    { area: [heading(visitor, "Welcome back"), act(visitor, "Create an account")] },
  )
  await open(visitor, "/sign-up?next=%2Faccept-invitation%2Fdemo-invite-sunset-bay")
  await shot(visitor, "invitation", [], {
    area: [visitor.locator("h1").first(), visitor.locator("form button").last()],
  })

  const phone = await visit(browser, STAFF, PHONE)
  await open(phone, "/")
  const home = await capture(phone, [
    [act(phone, "Add a guest"), "top"],
    [act(phone, "Redeem"), "top"],
  ])
  await act(phone, "More").click()
  await phone.waitForTimeout(500)
  await frame(phone, "phone", [home, await capture(phone, [])])

  const page = await visit(browser, MANAGER)
  await open(page, "/")
  await shot(page, "home", [
    [page.locator('[data-slot="sidebar-header"] [data-slot="sidebar-menu-item"]').first(), "right"],
    [act(page, "Guests"), "right"],
    [act(page, /^Search/), "bottom"],
    [act(page, "Notifications"), "bottom"],
    [act(page, "Add a guest"), "left"],
    [heading(page, "Needs you now"), "right"],
    [page.locator('[data-slot="sidebar-footer"] [data-slot="sidebar-menu-item"]').last(), "right"],
  ])
  await page.keyboard.press("ControlOrMeta+k")
  const palette = page.getByRole("dialog")
  await shot(page, "search", [[palette.getByRole("combobox"), "left"]], { area: [palette] })
  await page.keyboard.press("Escape")
  await open(page, "/settings")
  await tall(page, 1000)
  await shot(
    page,
    "account",
    [
      [heading(page, "Profile"), "left"],
      [heading(page, "Preferences"), "left"],
      [heading(page, /^Password/), "left"],
    ],
    { area: [main(page).locator("h1").first(), act(page, "Change password")] },
  )
})

test("front desk", async ({ browser }) => {
  const guestPhone = await visit(browser, undefined, PHONE)
  await open(guestPhone, "/h/sunset-bay?src=room&loc=101&lang=en", URLS.web)
  const decline = guestPhone.getByRole("button", { name: "Decline" })
  if (await decline.isVisible()) await decline.click()
  const form = await capture(guestPhone, [])
  await guestPhone.getByLabel(/name/i).first().fill("Amina Test")
  await guestPhone.getByLabel(/phone/i).and(guestPhone.locator("input")).first().fill("98765432")
  await guestPhone.getByRole("switch").or(guestPhone.getByRole("checkbox")).first().check({ force: true })
  await guestPhone.getByRole("button", { name: /^Join/ }).click()
  await guestPhone.waitForLoadState("networkidle")
  await guestPhone.waitForTimeout(1500)
  await frame(guestPhone, "guest-sign-up", [form, await capture(guestPhone, [])])

  const page = await visit(browser, STAFF)
  const guest = await richGuest()

  await open(page, "/guests/new")
  await tall(page, 1100)
  await shot(
    page,
    "add-guest",
    [
      [page.locator("#quick-phone"), "right"],
      [page.locator("#quick-name"), "right"],
      [
        page.getByRole("group", { name: "Language of the guest" }).or(page.getByRole("radiogroup").first()).first(),
        "right",
      ],
      [page.getByRole("checkbox").nth(1), "left"],
      [act(page, "Add guest"), "right"],
    ],
    { area: [main(page).locator("h1").first(), act(page, "Add guest")] },
  )
  await page.locator("#quick-phone").fill(guest.phone.replace("+", "00"))
  await page.locator("#quick-phone").fill(guest.phone)
  const known = text(page, "This number is already here")
  await shot(page, "add-guest-known", [[known, "right"]], {
    area: [main(page).locator("h1").first(), page.locator("#quick-name")],
  })

  await tall(page, 800)
  await open(page, "/guests")
  await shot(page, "guests", [
    [page.getByPlaceholder("Search by name or phone"), "left"],
    [act(page, "Returning"), "bottom"],
    [act(page, "Add guest"), "left"],
    [page.getByRole("row").nth(1), "left"],
  ])

  await open(page, `/guests/${guest.id}`)
  await tall(page, 900)
  const profile = (name: RegExp) =>
    main(page).getByRole("button", { name }).or(main(page).getByRole("link", { name })).first()
  await shot(
    page,
    "guest-profile",
    [
      [profile(/^Call/), "top"],
      [profile(/WhatsApp/), "top"],
      [profile(/^Email/), "top"],
      [profile(/^Edit/), "top"],
      [profile(/^Mark visit/), "bottom"],
      [profile(/^Give offer/), "bottom"],
    ],
    { area: [main(page).locator("h1").first(), heading(page, "Contact"), profile(/^Give offer/)] },
  )
  await shot(page, "guest-consent", [[act(page, /^Withdraw/), "top"]], {
    area: [heading(page, "Consent"), text(page, /^Consent log/)],
  })
  await act(page, "Give offer").click()
  const dialog = page.getByRole("dialog")
  await page.waitForLoadState("networkidle")
  const pick = await capture(page, [], { area: [dialog] })
  await dialog
    .getByRole("button", { name: /Welcome drink|Spa credit/ })
    .first()
    .click()
  await expect(dialog.getByRole("img")).toBeVisible()
  await frame(page, "give-offer", [pick, await capture(page, [], { area: [dialog] })])
  await page.keyboard.press("Escape")

  await open(page, "/redeem")
  await shot(
    page,
    "redeem",
    [
      [act(page, /Scan QR code/), "left"],
      [page.getByPlaceholder("AB3D-EF7H"), "left"],
      [act(page, "Check"), "right"],
      [text(page, "Latest redemptions"), "left"],
    ],
    { area: [main(page).locator("h1").first(), text(page, "Latest redemptions")] },
  )
  await page.getByPlaceholder("AB3D-EF7H").fill(await readyCode())
  await act(page, "Check").click()
  const redeem = act(page, "Mark as redeemed")
  await shot(
    page,
    "redeem-valid",
    [
      [text(page, "Valid. Ready to redeem."), "left"],
      [redeem, "left"],
    ],
    {
      area: [main(page).locator("h1").first(), redeem],
    },
  )

  await open(page, "/feedback")
  await shot(page, "unhappy-guests", [
    [act(page, /^New/), "bottom"],
    [page.getByRole("row").nth(1), "bottom"],
  ])
  await page.getByRole("row").nth(1).getByRole("link").first().click()
  await page.waitForURL(/feedback\/.+/)
  await page.waitForLoadState("networkidle")
  await shot(page, "unhappy-case", [
    [act(page, /^Call/), "bottom"],
    [text(page, "Survey answer"), "right"],
    [act(page, "Give offer"), "right"],
    [text(page, "Contacted"), "bottom"],
    [text(page, "Staff notes"), "left"],
  ])

  const phone = await visit(browser, STAFF, PHONE)
  const screens: Buffer[] = []
  for (const path of ["/guests", "/redeem", "/guests/new"]) {
    await open(phone, path)
    screens.push(await capture(phone, []))
  }
  await frame(phone, "desk-phone", screens)
})

const CSV = [
  "Full name,Mobile,E-mail,Language,Email consent,WhatsApp consent",
  "Marie Durand,+33 6 39 98 10 01,marie@example.com,fr,yes,yes",
  "Julien Petit,+33 6 39 98 10 02,julien@example.com,fr,no,yes",
  "Salma Ben Ali,98 111 222,,ar,no,yes",
  "No Phone,,nophone@example.com,en,yes,no",
].join("\n")

test("manager", async ({ browser }) => {
  const page = await visit(browser, MANAGER)

  await open(page, "/qr-codes")
  await tall(page, 900)
  await shot(
    page,
    "qr-studio",
    [
      [heading(page, /What to print/), "right"],
      [heading(page, /Which spots/), "right"],
      [heading(page, /Wording/), "right"],
      [text(page, "Preview"), "left"],
      [act(page, /Print or save PDF/), "left"],
      [
        act(page, /Test on my phone/)
          .or(act(page, /Open guest page/))
          .first(),
        "bottom",
      ],
    ],
    { area: [main(page).locator("h1").first(), text(page, "Show the welcome gift"), act(page, /Print or save PDF/)] },
  )

  await tall(page, 800)
  await open(page, "/guests/import")
  const upload = main(page).locator("h1").first()
  await shot(
    page,
    "import-upload",
    [
      [text(page, "Choose a CSV file or drop it here"), "right"],
      [
        act(page, /sample file/)
          .or(act(page, /sample file/))
          .first(),
        "right",
      ],
    ],
    {
      area: [
        upload,
        act(page, /sample file/)
          .or(act(page, /sample file/))
          .first(),
      ],
    },
  )
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "guests.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) })
  await tall(page, 1300)
  await shot(page, "import-match", [[act(page, "Continue"), "left"]], { area: [upload, act(page, "Continue")] })
  await act(page, "Continue").click()
  await page.waitForLoadState("networkidle")
  const submit = act(page, /^Import \d/)
  await shot(
    page,
    "import-review",
    [
      [text(page, /^I confirm our hotel/), "left"],
      [submit, "left"],
    ],
    {
      area: [upload, submit],
    },
  )

  await tall(page, 800)
  await open(page, "/offers")
  await shot(page, "offers", [
    [text(page, "Redeemed this week"), "right"],
    [act(page, "New offer"), "left"],
    [act(page, "Edit"), "left"],
  ])
  await open(page, "/offers/new")
  await tall(page, 1200)
  await page
    .getByLabel(/^Title/)
    .first()
    .fill("Late checkout")
  await page.getByLabel(/^Promo code/).fill("LATE14")
  await shot(
    page,
    "offer-new",
    [
      [page.getByLabel(/^Promo code/), "right"],
      [heading(page, "Other languages"), "left"],
      [heading(page, "Who gets it"), "left"],
      [heading(page, "When it is valid"), "left"],
      [text(page, /^Shown in the guest language/), "bottom"],
    ],
    { area: [main(page).locator("h1").first(), act(page, "Create offer")] },
  )

  await tall(page, 800)
  await open(page, "/campaigns")
  await shot(page, "campaigns", [
    [text(page, "Scheduled")],
    [act(page, "New campaign"), "left"],
    [page.getByRole("row").nth(1), "bottom"],
  ])
  await open(page, "/campaigns/new")
  await tall(page, 900)
  const next = act(page, "Next")
  const title = main(page).locator("h1").first()
  await shot(
    page,
    "campaign-audience",
    [
      [text(page, "Can be reached today"), "left"],
      [next, "right"],
    ],
    {
      area: [title, next],
    },
  )
  await next.click()
  await shot(page, "campaign-channel", [], { area: [title, next] })
  await next.click()
  await page.getByLabel(/^Subject/).fill("A quiet week by the sea")
  await page.getByLabel(/^Message text/).fill("Come back in January: late checkout is on us.")
  await shot(
    page,
    "campaign-message",
    [
      [page.getByLabel(/^Subject/), "right"],
      [text(page, "Preview"), "left"],
    ],
    {
      area: [title, next],
    },
  )
  await next.click()
  await shot(page, "campaign-send", [[text(page, "Send now"), "right"]], { area: [title, act(page, "Back")] })
  await open(page, `/campaigns/${await campaignId("scheduled")}`)
  await shot(
    page,
    "campaign-scheduled",
    [
      [act(page, "Send a test to me"), "top"],
      [act(page, "Duplicate"), "top"],
      [act(page, "Back to draft"), "right"],
      [act(page, "Cancel campaign"), "right"],
    ],
    { area: [title, act(page, "Cancel campaign")] },
  )

  await tall(page, 800)
  await open(page, "/holidays")
  await shot(page, "holidays", [
    [page.getByRole("switch").first(), "top"],
    [main(page).getByRole("combobox").first(), "bottom"],
  ])
  await open(page, "/emails")
  await shot(page, "emails", [
    [text(page, "Welcome"), "bottom"],
    [act(page, "Send test to me"), "right"],
  ])
  await open(page, "/metrics")
  await tall(page, 1000)
  await shot(page, "metrics", [], { area: [main(page).locator("h1").first(), text(page, "Survey score")] })
  await tall(page, 800)
  await open(page, "/messages")
  await shot(page, "messages", [
    [text(page, "Channel"), "right"],
    [text(page, "Status"), "right"],
  ])
})

test("owner", async ({ browser }) => {
  const page = await visit(browser, OWNER)
  await open(page, "/")
  const checklist = heading(page, "Get ready for your first guests")
  await shot(page, "checklist", [[text(page, "Add your logo"), "right"]], {
    area: [checklist, text(page, "Send yourself a test email")],
  })

  await open(page, "/hotel")
  await tall(page, 1500)
  await shot(
    page,
    "hotel-settings",
    [
      [act(page, "Upload logo").or(text(page, "Upload logo")).first(), "right"],
      [text(page, "Primary color"), "left"],
      [page.getByLabel(/^Reply-to email/), "left"],
      [act(page, "Send a test alert"), "right"],
      [text(page, "Low score alert"), "left"],
      [page.getByLabel(/^Google review link/), "left"],
    ],
    { area: [main(page).locator("h1").first(), page.getByLabel(/^Google review link/)] },
  )

  await tall(page, 800)
  await open(page, "/team")
  await shot(page, "team", [
    [page.getByLabel("Email").first(), "top"],
    [act(page, "Send invitation"), "bottom"],
    [act(page, "Copy link"), "bottom"],
    [act(page, "Send again"), "bottom"],
    [text(page, "What each role can do"), "right"],
  ])
  await open(page, "/data")
  await shot(page, "guest-data", [
    [act(page, "Export CSV"), "top"],
    [page.getByPlaceholder("Search guests"), "right"],
    [act(page, /Delete all guests/), "right"],
  ])
  await open(page, "/usage")
  await shot(page, "usage", [
    [text(page, "Balance"), "right"],
    [text(page, "Latest movements"), "right"],
  ])
  await open(page, "/activity")
  await shot(page, "activity", [[act(page, "Apply"), "top"]])
})
