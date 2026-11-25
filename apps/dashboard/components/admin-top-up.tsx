"use client"

import { formatTnd } from "@ritorno/common/pricing"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { AdminInput } from "@/components/admin-fields"

export function AdminTopUp({ hotelId, balanceMillimes }: { hotelId: string; balanceMillimes: number }) {
  const t = useTranslations("adminHotel")
  const locale = useLocale()
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const millimes = Math.round(Number(amount.replace(",", ".")) * 1000)
  const valid = Number.isFinite(millimes) && millimes >= 1000 && millimes <= 10_000_000

  const topUp = useMutation(
    orpc.admin.hotels.balance.topUp.mutationOptions({
      onSuccess: () => {
        toast.success(t("topUpDone"))
        setAmount("")
        setNote("")
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid) topUp.mutate({ id: hotelId, amountMillimes: millimes, note: note.trim() || undefined })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="font-heading font-semibold text-2xl tabular-nums" dir="ltr">
        {formatTnd(balanceMillimes, locale)}
      </p>
      <AdminInput
        label={t("topUpAmount")}
        hint={t("topUpAmountHint")}
        type="text"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        enterKeyHint="next"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <AdminInput
        label={t("topUpNote")}
        maxLength={200}
        autoComplete="off"
        enterKeyHint="done"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button type="submit" className="self-start" loading={topUp.isPending} disabled={!valid}>
        {t("topUp")}
      </Button>
    </form>
  )
}
