"use client"

import { BILLING_AMOUNT_MAX_MILLIMES } from "@ritorno/common/billing"
import type { BillingPlan } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { AdminInput } from "@/components/admin-fields"

const toInput = (millimes: number | null) => (millimes === null ? "" : String(millimes / 1000))

/** TND as typed (comma or dot) to millimes: `null` when empty, `undefined` when not an amount. */
function toMillimes(input: string): number | null | undefined {
  if (!input.trim()) return null
  const millimes = Math.round(Number(input.trim().replace(",", ".")) * 1000)
  return millimes >= 0 && millimes <= BILLING_AMOUNT_MAX_MILLIMES ? millimes : undefined
}

export function PlanForm({ plan }: { plan: BillingPlan }) {
  const t = useTranslations("adminBilling")
  const tHotel = useTranslations("adminHotel")
  const router = useRouter()
  const [name, setName] = useState(plan.name ?? "")
  const [price, setPrice] = useState(toInput(plan.monthlyMillimes))
  const millimes = toMillimes(price)
  const update = useMutation(
    orpc.admin.billing.updatePlan.mutationOptions({
      onSuccess: () => {
        toast.success(t("planSaved"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (millimes !== undefined) update.mutate({ plan: plan.plan, name: name.trim() || null, monthlyMillimes: millimes })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label={t("planName")}
          placeholder={tHotel(`plans.${plan.plan}`)}
          maxLength={40}
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <AdminInput
          label={t("monthlyPrice")}
          hint={t("monthlyPriceHint")}
          error={millimes === undefined ? t("amountError") : null}
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>
      <Button type="submit" variant="outline" className="self-start" loading={update.isPending}>
        {t("savePlan")}
      </Button>
    </form>
  )
}

export function InvoiceForm({ hotelId, defaultMillimes }: { hotelId: string; defaultMillimes: number | null }) {
  const t = useTranslations("adminBilling")
  const router = useRouter()
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const typed = toMillimes(amount)
  const millimes = typed === null ? defaultMillimes : typed
  const valid = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Boolean(millimes)
  const create = useMutation(
    orpc.admin.billing.createInvoice.mutationOptions({
      onSuccess: () => {
        toast.success(t("invoiceCreated"))
        setAmount("")
        setNote("")
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid) create.mutate({ hotelId, month, amountMillimes: typed ?? undefined, note: note.trim() || undefined })
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput
          label={t("month")}
          type="month"
          placeholder="2026-11"
          dir="ltr"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
        <AdminInput
          label={t("amount")}
          hint={defaultMillimes ? t("amountHint") : t("amountNoPrice")}
          error={typed === undefined ? t("amountError") : null}
          placeholder={toInput(defaultMillimes)}
          inputMode="decimal"
          dir="ltr"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      <AdminInput
        label={t("note")}
        hint={t("noteHint")}
        maxLength={200}
        autoComplete="off"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button type="submit" className="self-start" loading={create.isPending} disabled={!valid}>
        {t("create")}
      </Button>
    </form>
  )
}
