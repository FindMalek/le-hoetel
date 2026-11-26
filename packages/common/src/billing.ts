import { toCsv } from "./csv"

/** `void` is final: a wrong invoice is voided and a new one created, never deleted. */
export const INVOICE_STATUSES = ["issued", "paid", "void"] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const BILLING_AMOUNT_MAX_MILLIMES = 100_000_000

export interface ExportedInvoice {
  number: number
  hotelName: string
  month: string
  planName: string
  amountMillimes: number
  status: InvoiceStatus
  createdAt: Date
  paidAt: Date | null
  note: string | null
}

const COLUMNS = ["number", "hotel", "month", "plan", "amount_tnd", "status", "issued_at", "paid_at", "note"]

export function invoicesToCsv(invoices: ExportedInvoice[]): string {
  return toCsv([
    COLUMNS,
    ...invoices.map((invoice) => [
      String(invoice.number),
      invoice.hotelName,
      invoice.month,
      invoice.planName,
      (invoice.amountMillimes / 1000).toFixed(3),
      invoice.status,
      invoice.createdAt.toISOString(),
      invoice.paidAt?.toISOString() ?? "",
      invoice.note ?? "",
    ]),
  ])
}
