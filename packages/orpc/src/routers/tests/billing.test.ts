import { afterAll, beforeAll, expect, test } from "bun:test"
import { createTestApp, type TestApp } from "../../testing"

let app: TestApp
beforeAll(async () => {
  app = await createTestApp()
})
afterAll(() => app.close())

test("admin sets a price, invoices a month once, marks it paid, and the export and audit log hold it", async () => {
  const admin = await app.signUp("billing-admin@ritorno.test", { role: "admin" })
  const owner = await app.signUp("billing-owner@ritorno.test")
  const hotelId = await app.createHotel("billing-hotel", owner)
  const { billing } = admin.client.admin
  const create = () => billing.createInvoice({ hotelId, month: "2026-11" })

  await expect(owner.client.admin.billing.invoices()).rejects.toMatchObject({ code: "FORBIDDEN" })
  await expect(create()).rejects.toMatchObject({ code: "UNPROCESSABLE_CONTENT" })

  await billing.updatePlan({ plan: "starter", name: "=Essentiel", monthlyMillimes: 120_500 })
  const invoice = await create()
  expect(invoice).toMatchObject({ planName: "=Essentiel", amountMillimes: 120_500, status: "issued" })
  await expect(create()).rejects.toMatchObject({ code: "CONFLICT" })

  expect((await billing.setInvoiceStatus({ id: invoice.id, status: "paid" })).paidAt).toBeInstanceOf(Date)
  const { csv } = await billing.exportInvoices({ hotelId })
  // a plan name a spreadsheet would run as a formula is defused
  expect(csv).toContain(`"2026-11","'=Essentiel","120.500","paid"`)

  await billing.setInvoiceStatus({ id: invoice.id, status: "void" })
  await expect(billing.setInvoiceStatus({ id: invoice.id, status: "paid" })).rejects.toMatchObject({
    code: "CONFLICT",
  })
  const replacement = await billing.createInvoice({ hotelId, month: "2026-11", amountMillimes: 50_000 })
  expect(replacement.amountMillimes).toBe(50_000)

  // accounting records outlive the hotel
  await admin.client.admin.hotels.remove({ id: hotelId, confirmSlug: "billing-hotel" })
  expect(await billing.invoices({ hotelId })).toHaveLength(2)

  const { entries } = await admin.client.admin.audit.list({ action: "billing." })
  expect(new Set(entries.map((entry) => entry.action))).toEqual(
    new Set(["billing.export", "billing.invoice-create", "billing.invoice-status", "billing.plan-update"]),
  )
})
