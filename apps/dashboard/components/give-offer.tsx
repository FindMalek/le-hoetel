"use client"

// i18n-used: giveOffer.sent.queued
// i18n-used: giveOffer.sent.sent
// i18n-used: giveOffer.sent.delivered
// i18n-used: giveOffer.sent.failed
// i18n-used: giveOffer.sent.skipped_no_consent
// i18n-used: giveOffer.sent.skipped_no_balance
// i18n-used: giveOffer.send.email
// i18n-used: giveOffer.send.whatsapp
// i18n-used: giveOffer.state.redeemed
// i18n-used: giveOffer.state.inactive
// i18n-used: giveOffer.state.notStarted
// i18n-used: giveOffer.state.expired
// i18n-used: giveOffer.state.exhausted
import type { MessageChannel } from "@ritorno/common/consent"
import { offerState } from "@ritorno/common/offers"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ritorno/ui/components/dialog"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { LoadingState } from "@ritorno/ui/components/loading-state"
import { Skeleton } from "@ritorno/ui/components/skeleton"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ChevronRightIcon, GiftIcon, MailIcon, MessageCircleIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

const CHANNEL_ICON = { email: MailIcon, whatsapp: MessageCircleIcon }

/** Staff hand an offer to one guest: pick it, show the QR, send it on a channel the guest agreed to. */
export function GiveOffer({
  guestId,
  guestName,
  className,
}: {
  guestId: string
  guestName: string
  className?: string
}) {
  const t = useTranslations("giveOffer")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const offers = useQuery(orpc.offers.list.queryOptions({ enabled: open }))
  const give = useMutation(
    orpc.offers.give.mutationOptions({ onError: (error) => void toast.error(errorMessage(error)) }),
  )
  const send = useMutation(
    orpc.offers.send.mutationOptions({
      onSuccess: ({ status }) => {
        const say = status === "sent" || status === "delivered" || status === "queued" ? toast.success : toast.error
        say(t(`sent.${status}`))
        router.refresh()
      },
      onError: (error) =>
        void toast.error(
          (error as { code?: string }).code === "TOO_MANY_REQUESTS" ? t("justSent") : errorMessage(error),
        ),
    }),
  )
  const available = offers.data?.filter((offer) => offerState(offer, offer.redeemed, new Date()) === "ready") ?? []
  const given = give.data
  const offerId = give.variables?.offerId

  const change = (next: boolean) => {
    setOpen(next)
    if (!next) give.reset()
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger render={<Button variant="outline" size="lg" className={className} />}>
        <GiftIcon data-icon="inline-start" />
        {t("button")}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="max-h-11/12 grid-cols-1 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <DialogHeader>
            <DialogTitle>{given ? <bdi>{given.title}</bdi> : t("title")}</DialogTitle>
            <DialogDescription>
              {given ? t("showHint") : t.rich("pickHint", { name: () => <bdi>{guestName}</bdi> })}
            </DialogDescription>
          </DialogHeader>
          <DialogClose render={<Button variant="ghost" size="icon" className="shrink-0" aria-label={t("close")} />}>
            <XIcon />
          </DialogClose>
        </div>
        {given ? (
          <div className="flex flex-col gap-3">
            {given.state === "ready" ? (
              <>
                {/* biome-ignore lint/performance/noImgElement: an inline svg made by the api for this code */}
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(given.qrSvg)}`}
                  alt={t("qrAlt", { code: given.code })}
                  className="mx-auto aspect-square w-full max-w-56 rounded-lg bg-white p-2"
                />
                <bdi dir="ltr" className="text-center font-mono font-semibold text-2xl tracking-widest">
                  {given.code}
                </bdi>
                {given.channels.map((channel: MessageChannel) => {
                  const Icon = CHANNEL_ICON[channel]
                  return (
                    <Button
                      key={channel}
                      size="lg"
                      variant="outline"
                      loading={send.isPending && send.variables?.channel === channel}
                      disabled={send.isPending}
                      onClick={() => send.mutate({ guestId, offerId: offerId!, channel })}
                    >
                      <Icon data-icon="inline-start" />
                      {t(`send.${channel}`)}
                    </Button>
                  )
                })}
                {given.channels.length ? null : <p className="text-muted-foreground">{t("noChannel")}</p>}
              </>
            ) : (
              <InlineAlert tone="warning" title={t(`state.${given.state}`)} />
            )}
            <Button size="lg" variant="ghost" onClick={() => give.reset()}>
              {t("another")}
            </Button>
          </div>
        ) : offers.isError ? (
          <InlineAlert tone="error" title={t("loadError")} />
        ) : !offers.data ? (
          <LoadingState label={t("loading")}>
            <Skeleton className="h-24 w-full" />
          </LoadingState>
        ) : available.length ? (
          <ul className="flex flex-col gap-2">
            {available.map((offer) => (
              <li key={offer.id}>
                <Button
                  variant="outline"
                  className="h-auto min-h-12 w-full justify-between whitespace-normal py-2 text-start"
                  loading={give.isPending && offerId === offer.id}
                  disabled={give.isPending}
                  onClick={() => give.mutate({ guestId, offerId: offer.id })}
                >
                  <bdi className="min-w-0 break-words">{offer.title}</bdi>
                  <ChevronRightIcon className="rtl:rotate-180" data-icon="inline-end" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("none")}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
