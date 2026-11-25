"use client"

import { type OfferState, offerState } from "@le-hoetel/common/offers"
import type { Offer } from "@le-hoetel/common/schemas"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Badge } from "@le-hoetel/ui/components/badge"
import { Button } from "@le-hoetel/ui/components/button"
import { ConfirmDialog } from "@le-hoetel/ui/components/confirm-dialog"
import { type DataColumn, DataTable } from "@le-hoetel/ui/components/data-table"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { StatCard } from "@le-hoetel/ui/components/stat-card"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { GiftIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { LocalDate } from "./local-date"

const STATE_VARIANT: Record<OfferState, "default" | "secondary" | "outline"> = {
  ready: "default",
  inactive: "outline",
  notStarted: "secondary",
  expired: "outline",
  exhausted: "secondary",
}

function Redeemed({ offer }: { offer: Offer }) {
  const t = useTranslations("offers")
  const ratio = offer.maxRedemptions ? Math.min(100, Math.round((offer.redeemed / offer.maxRedemptions) * 100)) : null
  return (
    <div className="flex min-w-24 flex-col gap-1.5">
      <span className="text-sm tabular-nums">
        {offer.maxRedemptions === null
          ? t("redeemed", { count: offer.redeemed })
          : t("redeemedOf", { count: offer.redeemed, max: offer.maxRedemptions })}
      </span>
      {ratio === null ? null : (
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
        </span>
      )}
    </div>
  )
}

export function OffersBoard({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("offers")
  const queryClient = useQueryClient()
  const { data: offers } = useSuspenseQuery(orpc.offers.list.queryOptions())
  const { data: stats } = useSuspenseQuery(orpc.offers.redemptionStats.queryOptions())
  const [removing, setRemoving] = useState<Offer | null>(null)
  const remove = useMutation(
    orpc.offers.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("removed"))
        setRemoving(null)
        return queryClient.invalidateQueries({ queryKey: orpc.offers.key() })
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const now = new Date()
  const stateOf = (offer: Offer) => offerState(offer, offer.redeemed, now)
  const active = offers.filter((offer) => stateOf(offer) === "ready").length

  const statusBadge = (offer: Offer) => (
    <Badge variant={STATE_VARIANT[stateOf(offer)]}>{t(`state.${stateOf(offer)}`)}</Badge>
  )
  const validity = (offer: Offer) =>
    offer.validUntil ? (
      <span>
        {t("until")} <LocalDate value={offer.validUntil} />
      </span>
    ) : (
      <span className="text-muted-foreground">{t("forever")}</span>
    )
  const actions = (offer: Offer) =>
    canEdit ? (
      <div className="flex items-center justify-end gap-1">
        <Button variant="outline" size="sm" render={<Link href={`/offers/${offer.id}/edit`} />} nativeButton={false}>
          <PencilIcon data-icon="inline-start" />
          {t("edit")}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("remove")} onClick={() => setRemoving(offer)}>
          <Trash2Icon />
        </Button>
      </div>
    ) : null

  const columns: DataColumn<Offer>[] = [
    {
      id: "offer",
      header: t("columns.offer"),
      cell: (offer) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{offer.title}</span>
          <bdi dir="ltr" className="font-mono text-muted-foreground text-xs tracking-wider">
            {offer.promoCode}
          </bdi>
        </div>
      ),
    },
    { id: "status", header: t("columns.status"), cell: statusBadge },
    {
      id: "trigger",
      header: t("columns.trigger"),
      showFrom: "lg",
      cell: (offer) => (offer.trigger ? t(`trigger.${offer.trigger}`) : t("triggerNoneShort")),
    },
    { id: "redeemed", header: t("columns.redeemed"), cell: (offer) => <Redeemed offer={offer} /> },
    { id: "valid", header: t("columns.valid"), showFrom: "lg", cell: validity },
    { id: "actions", header: <span className="sr-only">{t("columns.actions")}</span>, align: "end", cell: actions },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("stats.active")} value={active} hint={t("stats.activeHint", { count: offers.length })} />
        <StatCard label={t("stats.week")} value={stats.week} hint={t("stats.weekHint", { today: stats.today })} />
        <StatCard label={t("stats.total")} value={stats.total} hint={t("stats.totalHint")} />
      </div>
      <DataTable
        caption={t("title")}
        columns={columns}
        rows={offers}
        getRowKey={(offer) => offer.id}
        card={(offer) => (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">{offer.title}</span>
                <bdi dir="ltr" className="self-start font-mono text-muted-foreground text-xs tracking-wider">
                  {offer.promoCode}
                </bdi>
              </div>
              {statusBadge(offer)}
            </div>
            <Redeemed offer={offer} />
            <p className="text-muted-foreground text-sm">{validity(offer)}</p>
            {actions(offer)}
          </div>
        )}
        empty={
          <EmptyState
            decorated
            icon={<GiftIcon />}
            title={t("empty")}
            description={t("emptyHint")}
            action={
              canEdit ? (
                <Button render={<Link href="/offers/new" />} nativeButton={false}>
                  <PlusIcon data-icon="inline-start" />
                  {t("add")}
                </Button>
              ) : undefined
            }
          />
        }
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeTitle")}
        description={t("removeBody", { title: removing?.title ?? "" })}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        destructive
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate({ id: removing.id })}
      />
    </div>
  )
}
