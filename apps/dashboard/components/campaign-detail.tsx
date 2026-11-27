"use client"

import { CAMPAIGN_NAME_MAX } from "@ritorno/common/campaigns"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
// i18n-used: campaigns
import { localizedOffer } from "@ritorno/common/offers"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { FormField } from "@ritorno/ui/components/form-field"
import { Input } from "@ritorno/ui/components/input"
import { Num } from "@ritorno/ui/components/num"
import { Section } from "@ritorno/ui/components/section"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { CalendarClockIcon, CopyIcon, PencilLineIcon, SendIcon, Trash2Icon, XCircleIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { localInput } from "./campaign-form"
import { CampaignPreview, type CampaignPreviewCopies } from "./campaign-preview"
import { CampaignStatusBadge, campaignState, useAudience } from "./campaigns-list"

type Confirm = "send" | "schedule" | "cancel" | "delete"

export function CampaignDetail({
  id,
  hotelName,
  defaultLanguage,
  copies,
}: {
  id: string
  hotelName: string
  defaultLanguage: HotelLanguage
  copies: CampaignPreviewCopies
}) {
  const t = useTranslations("campaigns")
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: campaign } = useSuspenseQuery(
    orpc.campaigns.get.queryOptions({
      input: { id },
      refetchInterval: (query) => (["scheduled", "sending"].includes(query.state.data?.status ?? "") ? 5_000 : false),
    }),
  )
  const { guests: audience, refresh: refreshAudience } = useAudience(campaign)
  const [counted, setCounted] = useState(false)
  const [countFailed, setCountFailed] = useState(false)
  const { data: offers } = useQuery(orpc.offers.list.queryOptions())
  const languages = HOTEL_LANGUAGES.filter((language) => campaign.content[language])
  const [language, setLanguage] = useState<HotelLanguage>(
    languages.find((value) => value === locale) ??
      languages.find((value) => value === defaultLanguage) ??
      languages[0] ??
      "fr",
  )
  const [at, setAt] = useState("")
  const [atTouched, setAtTouched] = useState(false)
  const [confirm, setConfirmKind] = useState<Confirm>("send")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const setConfirm = (next: Confirm | null) => {
    if (next) {
      setConfirmKind(next)
      // the count in a confirm is always fetched again, never the cached one
      setCounted(false)
      setCountFailed(false)
      void refreshAudience().then((ok) => {
        setCounted(ok)
        setCountFailed(!ok)
      })
    }
    setConfirmOpen(next !== null)
  }

  const done = (message: string) => () => {
    toast.success(message)
    setConfirm(null)
    router.refresh()
    return queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() })
  }
  const onError = (error: Error) => {
    setConfirm(null)
    toast.error(errorMessage(error))
  }
  const schedule = useMutation(orpc.campaigns.schedule.mutationOptions({ onError }))
  const cancel = useMutation(orpc.campaigns.cancel.mutationOptions({ onSuccess: done(t("detail.cancelled")), onError }))
  const test = useMutation(
    orpc.campaigns.testSend.mutationOptions({
      onSuccess: (result) => toast.success(t("detail.testSent", { to: result.to })),
      onError,
    }),
  )
  const unschedule = useMutation(
    orpc.campaigns.unschedule.mutationOptions({ onSuccess: done(t("detail.unscheduled")), onError }),
  )
  const duplicate = useMutation(
    orpc.campaigns.duplicate.mutationOptions({
      onSuccess: (copy) => {
        toast.success(t("detail.duplicated"))
        void queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() })
        router.push(`/campaigns/${copy.id}`)
      },
      onError,
    }),
  )
  const remove = useMutation(
    orpc.campaigns.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("detail.deleted"))
        void queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() })
        router.push("/campaigns")
      },
      onError,
    }),
  )

  const { results } = campaign
  const pending = Math.max(results.targeted - results.sent - results.delivered - results.failed - results.skipped, 0)
  const state = campaignState(campaign)
  const isDraft = campaign.status === "draft"
  const running = campaign.status === "scheduled" || campaign.status === "sending"
  const canDelete = isDraft || campaign.status === "cancelled"
  const offer = offers?.find((item) => item.id === campaign.offerId)
  const offerTitle = offer ? localizedOffer(offer, language).title : null
  const text = campaign.content[language] ?? campaign.content[languages[0] ?? "fr"] ?? { subject: "", body: "" }
  const channel = t(`channel.${campaign.channel}`)
  const num = (value: number) => <Num value={value} locale={locale} className="tabular-nums" />
  const date = (value: Date | null) =>
    value ? new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : ""
  const atError = !at ? t("errors.at") : new Date(at).getTime() < Date.now() ? t("errors.atPast") : undefined
  const noAudience = audience === 0

  const countedTitle = (key: "confirm.sendTitle" | "confirm.scheduleTitle") =>
    counted && audience !== null
      ? t.rich(key, { count: audience, n: () => num(audience) })
      : t(countFailed ? "errors.count" : "counting")
  const needsCount = confirm === "send" || confirm === "schedule" || (confirm === "delete" && isDraft)
  const confirmBlocked = needsCount && (!counted || ((confirm === "send" || confirm === "schedule") && !audience))
  const confirmCopy: Record<Confirm, { title: React.ReactNode; body: string; label: string; destructive?: boolean }> = {
    send: {
      title: countedTitle("confirm.sendTitle"),
      body: counted && audience === 0 ? t("errors.audience") : t("confirm.sendBody", { channel }),
      label: t("detail.sendNow"),
    },
    schedule: {
      title: countedTitle("confirm.scheduleTitle"),
      body:
        counted && audience === 0
          ? t("errors.audience")
          : t("confirm.scheduleBody", { channel, date: at ? date(new Date(at)) : "" }),
      label: t("detail.schedule"),
    },
    cancel: {
      title: t("detail.cancelTitle"),
      body: t("confirm.cancelBody", { count: pending, channel }),
      label: t("detail.cancel"),
      destructive: true,
    },
    delete: {
      title: t("confirm.deleteTitle", { name: campaign.name }),
      body: isDraft
        ? counted
          ? t("confirm.deleteDraftBody", { count: audience ?? 0, channel })
          : t(countFailed ? "errors.count" : "counting")
        : t("confirm.deleteBody", { count: results.targeted, channel }),
      label: t("detail.delete"),
      destructive: true,
    },
  }
  const confirmPending = schedule.isPending || cancel.isPending || remove.isPending
  function onConfirm() {
    if (confirm === "send" || confirm === "schedule") {
      const message = confirm === "send" ? t("detail.sending") : t("detail.scheduled")
      schedule.mutate({ id, at: confirm === "schedule" ? new Date(at) : null }, { onSuccess: done(message) })
    } else if (confirm === "cancel") cancel.mutate({ id })
    else remove.mutate({ id })
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="campaign-state" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <CampaignStatusBadge campaign={campaign} />
          <p id="campaign-state" className="text-muted-foreground">
            {t(`detail.state.${state}`, {
              date: date(campaign.completedAt ?? campaign.scheduledAt),
              done: results.targeted - pending,
              total: results.targeted,
            })}
          </p>
        </div>
        <div className={isDraft ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "grid grid-cols-2 gap-3 lg:grid-cols-4"}>
          <StatCard
            label={isDraft ? t("results.audience") : t("results.targeted")}
            value={audience === null ? "…" : num(audience)}
            hint={channel}
          />
          {isDraft ? null : (
            <>
              <StatCard
                label={t("results.sent")}
                value={num(results.sent + results.delivered)}
                hint={results.delivered ? t("results.delivered", { count: results.delivered }) : undefined}
              />
              <StatCard label={t("results.failed")} value={num(results.failed)} />
              <StatCard
                label={t("results.skipped")}
                value={num(results.skipped + pending)}
                hint={t("results.skippedHint")}
              />
            </>
          )}
        </div>
      </section>

      <div className={isDraft || running || canDelete ? "grid items-start gap-8 lg:grid-cols-5" : "max-w-3xl"}>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          <CampaignPreview
            title={t("detail.messageTitle")}
            extra={
              languages.length > 1 ? (
                <SegmentedControl
                  label={t("form.writeIn")}
                  value={language}
                  onValueChange={setLanguage}
                  options={languages.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
                />
              ) : null
            }
            hotelName={hotelName}
            channel={campaign.channel}
            language={language}
            subject={text.subject}
            body={text.body}
            offerTitle={offerTitle}
            copies={copies}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              loading={test.isPending}
              onClick={() => test.mutate({ id, language })}
            >
              {t("detail.testSend")}
            </Button>
            <Button
              type="button"
              variant="outline"
              loading={duplicate.isPending}
              onClick={() =>
                duplicate.mutate({
                  id,
                  name: t("detail.copyName", { name: campaign.name }).slice(0, CAMPAIGN_NAME_MAX),
                })
              }
            >
              <CopyIcon data-icon="inline-start" />
              {t("detail.duplicate")}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {isDraft ? (
            <Section
              title={t("detail.sendTitle")}
              description={t("detail.quietNote")}
              className="rounded-xl border p-4 md:p-5"
            >
              {noAudience ? <p className="text-destructive text-sm">{t("errors.audience")}</p> : null}
              <Button
                type="button"
                className="w-full"
                disabled={noAudience || audience === null}
                onClick={() => setConfirm("send")}
              >
                <SendIcon data-icon="inline-start" className="rtl:-scale-x-100" />
                {t("detail.sendNow")}
              </Button>
              <div className="flex items-center gap-3 text-muted-foreground text-xs" aria-hidden>
                <span className="h-px flex-1 bg-border" />
                {t("detail.or")}
                <span className="h-px flex-1 bg-border" />
              </div>
              <FormField id="campaign-at" label={t("detail.scheduleAt")} error={atTouched ? atError : undefined}>
                {(aria) => (
                  <Input
                    {...aria}
                    type="datetime-local"
                    dir="ltr"
                    min={localInput(new Date())}
                    value={at}
                    onChange={(event) => setAt(event.target.value)}
                    onBlur={() => setAtTouched(true)}
                  />
                )}
              </FormField>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={noAudience || audience === null}
                onClick={() => {
                  setAtTouched(true)
                  if (!atError) setConfirm("schedule")
                }}
              >
                <CalendarClockIcon data-icon="inline-start" />
                {t("detail.schedule")}
              </Button>
            </Section>
          ) : null}

          {campaign.status === "scheduled" ? (
            <Section title={t("detail.changeTitle")} className="rounded-xl border p-4 md:p-5">
              <p className="text-muted-foreground text-sm">{t("detail.unscheduleHint")}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                loading={unschedule.isPending}
                onClick={() => unschedule.mutate({ id })}
              >
                <PencilLineIcon data-icon="inline-start" />
                {t("detail.unschedule")}
              </Button>
            </Section>
          ) : null}

          {running || canDelete ? (
            <Section title={t("detail.dangerTitle")} className="rounded-xl border border-destructive/30 p-4 md:p-5">
              {running ? (
                <>
                  <p className="text-muted-foreground text-sm">{t("detail.cancelHint")}</p>
                  <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirm("cancel")}>
                    <XCircleIcon data-icon="inline-start" />
                    {t("detail.cancel")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">{t("detail.deleteHint")}</p>
                  <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirm("delete")}>
                    <Trash2Icon data-icon="inline-start" />
                    {t("detail.delete")}
                  </Button>
                </>
              )}
            </Section>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmCopy[confirm].title}
        description={confirmCopy[confirm].body}
        confirmLabel={confirmCopy[confirm].label}
        cancelLabel={t("confirm.back")}
        destructive={confirmCopy[confirm].destructive}
        pending={confirmPending}
        confirmDisabled={confirmBlocked}
        onConfirm={onConfirm}
      />
    </div>
  )
}
