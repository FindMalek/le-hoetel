"use client"

import type { InvoiceStatus } from "@ritorno/common/billing"
import { formatTnd } from "@ritorno/common/pricing"
import type { Invoice } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { useMutation } from "@tanstack/react-query"
import { DownloadIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { download, today } from "@/lib/download"

const TONE: Record<InvoiceStatus, StatusTone> = { issued: "warning", paid: "success", void: "neutral" }

const monthLabel = (month: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", numberingSystem: "latn", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  )

export function InvoiceExport({ hotelId, disabled }: { hotelId?: string; disabled: boolean }) {
  const t = useTranslations("adminBilling")
  const exporting = useMutation(
    orpc.admin.billing.exportInvoices.mutationOptions({
      // the BOM makes Excel read Arabic and accents as UTF-8
      onSuccess: ({ csv }) => download(`invoices-${today()}.csv`, `﻿${csv}`, "text/csv;charset=utf-8"),
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  return (
    <Button
      variant="outline"
      className="self-start"
      loading={exporting.isPending}
      disabled={disabled}
      onClick={() => exporting.mutate({ hotelId })}
    >
      <DownloadIcon data-icon="inline-start" />
      {t("export")}
    </Button>
  )
}

/** `showHotel` for the platform wide list, where each row names and links its hotel. */
export function InvoiceList({ invoices, showHotel }: { invoices: Invoice[]; showHotel?: boolean }) {
  const t = useTranslations("adminBilling")
  const locale = useLocale()
  const router = useRouter()
  const [voiding, setVoiding] = useState<Invoice | null>(null)
  const setStatus = useMutation(
    orpc.admin.billing.setInvoiceStatus.mutationOptions({
      onSuccess: () => {
        setVoiding(null)
        toast.success(t("invoiceUpdated"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  if (!invoices.length) return <p className="text-muted-foreground text-small">{t("empty")}</p>

  return (
    <>
      <ul className="flex flex-col divide-y rounded-card border">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <bdi dir="ltr" className="font-medium">
                  #{invoice.number}
                </bdi>
                {showHotel ? (
                  <Link
                    href={`/admin/hotels/${invoice.hotelId}`}
                    className="truncate underline-offset-4 hover:underline"
                  >
                    <bdi>{invoice.hotelName}</bdi>
                  </Link>
                ) : null}
                <StatusBadge tone={TONE[invoice.status]}>{t(`statuses.${invoice.status}`)}</StatusBadge>
              </span>
              <span className="text-muted-foreground text-small">
                {monthLabel(invoice.month, locale)} · <bdi>{invoice.planName}</bdi> ·{" "}
                <bdi dir="ltr" className="text-foreground tabular-nums">
                  {formatTnd(invoice.amountMillimes, locale)}
                </bdi>
              </span>
              <span className="text-caption text-muted-foreground">
                {invoice.paidAt
                  ? t("paidOn", { date: formatDate(invoice.paidAt, locale, "Africa/Tunis") })
                  : t("issuedOn", { date: formatDate(invoice.createdAt, locale, "Africa/Tunis") })}
                {invoice.note ? (
                  <>
                    {" · "}
                    <bdi>{invoice.note}</bdi>
                  </>
                ) : null}
              </span>
            </div>
            {invoice.status === "void" ? null : (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="outline"
                  loading={setStatus.isPending && setStatus.variables?.id === invoice.id && !voiding}
                  onClick={() =>
                    setStatus.mutate({ id: invoice.id, status: invoice.status === "paid" ? "issued" : "paid" })
                  }
                >
                  {t(invoice.status === "paid" ? "markUnpaid" : "markPaid")}
                </Button>
                <Button variant="ghost" onClick={() => setVoiding(invoice)}>
                  {t("void")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={voiding !== null}
        onOpenChange={(open) => !open && setVoiding(null)}
        destructive
        pending={setStatus.isPending}
        title={t("voidTitle", { number: voiding?.number ?? 0 })}
        description={t("voidConsequence")}
        confirmLabel={t("void")}
        cancelLabel={t("cancel")}
        onConfirm={() => voiding && setStatus.mutate({ id: voiding.id, status: "void" })}
      />
    </>
  )
}
