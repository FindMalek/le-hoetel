"use client"

import { type OfferState, offerState } from "@ritorno/common/offers"
import type { Offer } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { Num } from "@ritorno/ui/components/num"
import { PageState } from "@ritorno/ui/components/page-state"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import {
  CakeIcon,
  CalendarIcon,
  GiftIcon,
  HandHeartIcon,
  MegaphoneIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundCheckIcon,
} from "lucide-react"
import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

const STATE_TONE: Record<OfferState, StatusTone> = {
  ready: "success",
  inactive: "neutral",
  notStarted: "info",
  expired: "neutral",
  exhausted: "warning",
}

const TRIGGER_ICON = { welcome: HandHeartIcon, birthday: CakeIcon, manual: UserRoundCheckIcon } as const

function Redeemed({ offer }: { offer: Offer }) {
  const t = useTranslations("offers")
  const locale = useLocale()
  const ratio = offer.maxRedemptions ? Math.min(100, Math.round((offer.redeemed / offer.maxRedemptions) * 100)) : null
  const count = <Num value={offer.redeemed} locale={locale} className="font-semibold text-foreground tabular-nums" />
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-sm">
        {offer.maxRedemptions === null
          ? t.rich("redeemed", { count: offer.redeemed, n: () => count })
          : t.rich("redeemedOf", {
              count: offer.redeemed,
              n: () => count,
              max: () => <Num value={offer.maxRedemptions ?? 0} locale={locale} className="tabular-nums" />,
            })}
      </span>
      {ratio === null ? null : (
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface">
          <span
            className="block h-full w-(--ratio) rounded-full bg-primary"
            // the bar fills to the redeemed share
            // oxlint-disable-next-line shadcn/no-inline-styles
            style={{ "--ratio": `${ratio}%` } as React.CSSProperties}
          />
        </span>
      )}
    </div>
  )
}

function OfferCard({
  offer,
  state,
  campaigns,
  canEdit,
  onRemove,
}: {
  offer: Offer
  state: OfferState
  campaigns: number
  canEdit: boolean
  onRemove: () => void
}) {
  const t = useTranslations("offers")
  const locale = useLocale()
  const day = (value: Date) => new Date(value).toLocaleDateString(locale, { dateStyle: "medium" })
  const TriggerIcon = offer.trigger ? TRIGGER_ICON[offer.trigger] : UserRoundCheckIcon
  return (
    <li className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-balance break-words font-semibold text-h3">{offer.title}</h3>
          <bdi dir="ltr" className="self-start font-mono text-muted-foreground text-xs tracking-wider">
            {offer.promoCode}
          </bdi>
        </div>
        <StatusBadge tone={STATE_TONE[state]}>{t(`state.${state}`)}</StatusBadge>
      </div>
      {offer.text ? <p className="line-clamp-2 text-pretty text-muted-foreground text-sm">{offer.text}</p> : null}
      <ul className="flex flex-wrap gap-2 text-xs">
        <li className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3">
          <TriggerIcon aria-hidden className="size-3.5" />
          {offer.trigger ? t(`trigger.${offer.trigger}`) : t("triggerNoneShort")}
        </li>
        {campaigns ? (
          <li className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3">
            <MegaphoneIcon aria-hidden className="size-3.5" />
            {t.rich("inCampaigns", { count: campaigns, n: () => <Num value={campaigns} locale={locale} /> })}
          </li>
        ) : null}
        <li className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3">
          <CalendarIcon aria-hidden className="size-3.5" />
          <span suppressHydrationWarning>
            {offer.validUntil
              ? t("between", { from: day(offer.validFrom), until: day(offer.validUntil) })
              : t("since", { from: day(offer.validFrom) })}
          </span>
        </li>
      </ul>
      <Redeemed offer={offer} />
      {canEdit ? (
        <div className="mt-auto flex items-center justify-end gap-2 border-t pt-4">
          <Button variant="ghost" size="icon" aria-label={t("removeNamed", { title: offer.title })} onClick={onRemove}>
            <Trash2Icon />
          </Button>
          <Button variant="outline" render={<Link href={`/offers/${offer.id}/edit`} />} nativeButton={false}>
            <PencilIcon data-icon="inline-start" />
            {t("edit")}
          </Button>
        </div>
      ) : null}
    </li>
  )
}

export function OffersBoard({ canEdit }: { canEdit: boolean }) {
  const t = useTranslations("offers")
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { data: offers } = useSuspenseQuery(orpc.offers.list.queryOptions())
  const { data: stats } = useSuspenseQuery(orpc.offers.redemptionStats.queryOptions())
  const { data: campaigns } = useQuery({ ...orpc.campaigns.list.queryOptions(), enabled: canEdit, retry: false })
  const [removing, setRemoving] = useState<Offer | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const remove = useMutation(
    orpc.offers.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("removed"))
        setConfirmOpen(false)
        return queryClient.invalidateQueries({ queryKey: orpc.offers.key() })
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const now = new Date()
  const stateOf = (offer: Offer) => offerState(offer, offer.redeemed, now)
  const active = offers.filter((offer) => stateOf(offer) === "ready").length
  const usedIn = (offer: Offer) => campaigns?.filter((campaign) => campaign.offerId === offer.id).length ?? 0
  const num = (value: number) => <Num value={value} locale={locale} />

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("stats.active")}
          value={num(active)}
          hint={t("stats.activeHint", { count: offers.length })}
        />
        <StatCard label={t("stats.week")} value={num(stats.week)} hint={t("stats.weekHint", { today: stats.today })} />
        <StatCard label={t("stats.total")} value={num(stats.total)} hint={t("stats.totalHint")} />
      </div>
      {offers.length ? (
        <ul aria-label={t("title")} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              state={stateOf(offer)}
              campaigns={usedIn(offer)}
              canEdit={canEdit}
              onRemove={() => {
                setRemoving(offer)
                setConfirmOpen(true)
              }}
            />
          ))}
        </ul>
      ) : (
        <PageState
          kind="empty"
          firstRun
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
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("removeTitle")}
        description={t("removeBody", {
          title: removing?.title ?? "",
          count: removing?.redeemed ?? 0,
          campaigns: removing ? usedIn(removing) : 0,
        })}
        confirmLabel={t("remove")}
        cancelLabel={t("cancel")}
        destructive
        pending={remove.isPending}
        onConfirm={() => removing && remove.mutate({ id: removing.id })}
      />
    </div>
  )
}
