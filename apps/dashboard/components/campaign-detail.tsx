"use client"

// i18n-used: campaigns
import { CAMPAIGN_STATUSES, pickContent } from "@ritorno/common/campaigns"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ritorno/ui/components/alert-dialog"
import { Button } from "@ritorno/ui/components/button"
import { Input } from "@ritorno/ui/components/input"
import { Section } from "@ritorno/ui/components/section"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"
import { CampaignStatusBadge } from "./campaigns-list"

void CAMPAIGN_STATUSES

export function CampaignDetail({ id }: { id: string }) {
  const t = useTranslations("campaigns")
  const locale = useLocale() as HotelLanguage
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: campaign } = useSuspenseQuery(
    orpc.campaigns.get.queryOptions({
      input: { id },
      refetchInterval: (query) => (["scheduled", "sending"].includes(query.state.data?.status ?? "") ? 5_000 : false),
    }),
  )
  const [at, setAt] = useState("")
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() })
  const onError = (error: Error) => toast.error(errorMessage(error))
  const schedule = useMutation(
    orpc.campaigns.schedule.mutationOptions({
      onSuccess: () => {
        toast.success(t("detail.scheduled"))
        return refresh()
      },
      onError,
    }),
  )
  const cancel = useMutation(
    orpc.campaigns.cancel.mutationOptions({
      onSuccess: () => {
        toast.success(t("detail.cancelled"))
        return refresh()
      },
      onError,
    }),
  )
  const test = useMutation(
    orpc.campaigns.testSend.mutationOptions({
      onSuccess: (result) => toast.success(t("detail.testSent", { to: result.to })),
      onError,
    }),
  )
  const remove = useMutation(
    orpc.campaigns.delete.mutationOptions({ onSuccess: () => router.push("/campaigns"), onError }),
  )

  const { results } = campaign
  const pending = Math.max(results.targeted - results.sent - results.delivered - results.failed - results.skipped, 0)
  const reached = results.sent + results.delivered
  const languages = HOTEL_LANGUAGES.filter((language) => campaign.content[language])
  const preview = pickContent(campaign.content, locale, languages[0] ?? "fr")
  const isDraft = campaign.status === "draft"
  const running = campaign.status === "scheduled" || campaign.status === "sending"

  return (
    <div className="flex flex-col gap-8">
      <Section
        title={campaign.name}
        description={t(`channel.${campaign.channel}`)}
        actions={<CampaignStatusBadge status={campaign.status} />}
      >
        {campaign.scheduledAt && campaign.status !== "draft" ? (
          <p className="text-muted-foreground text-sm">
            {t("detail.startsAt", {
              date: new Date(campaign.scheduledAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
            })}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label={t("results.targeted")} value={results.targeted} />
          <StatCard
            label={t("results.sent")}
            value={reached}
            hint={results.delivered ? t("results.delivered", { count: results.delivered }) : undefined}
          />
          <StatCard label={t("results.failed")} value={results.failed} />
          <StatCard label={t("results.skipped")} value={results.skipped + pending} />
        </div>
      </Section>

      <Section
        title={t("detail.messageTitle")}
        description={languages.map((language) => LOCALE_NAMES[language]).join(", ")}
      >
        <div className="flex max-w-xl flex-col gap-2 rounded-lg border p-4" dir={locale === "ar" ? "rtl" : "ltr"}>
          <p className="font-medium">{preview.subject}</p>
          <p className="whitespace-pre-line text-sm">{preview.body}</p>
        </div>
      </Section>

      <Section title={t("detail.actions")} className="max-w-xl">
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full md:h-9 md:w-fit"
            disabled={test.isPending}
            onClick={() => test.mutate({ id, language: locale })}
          >
            {t("detail.testSend")}
          </Button>
          {isDraft ? (
            <>
              <Button
                type="button"
                className="h-11 w-full md:h-9 md:w-fit"
                disabled={schedule.isPending}
                onClick={() => schedule.mutate({ id, at: null })}
              >
                {t("detail.sendNow")}
              </Button>
              <p className="text-muted-foreground text-sm">{t("detail.quietNote")}</p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  type="datetime-local"
                  aria-label={t("detail.scheduleAt")}
                  className="h-11 md:w-64"
                  value={at}
                  onChange={(event) => setAt(event.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 md:h-9"
                  disabled={!at || schedule.isPending}
                  onClick={() => schedule.mutate({ id, at: new Date(at) })}
                >
                  {t("detail.schedule")}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="h-11 w-full md:h-9 md:w-fit"
                render={<Link href={`/campaigns/${id}/edit`} />}
                nativeButton={false}
              >
                {t("detail.edit")}
              </Button>
            </>
          ) : null}
          {running ? (
            <AlertDialog>
              <AlertDialogTrigger
                render={<Button type="button" variant="destructive" className="h-11 w-full md:h-9 md:w-fit" />}
              >
                {t("detail.cancel")}
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("detail.cancelTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("detail.cancelBody")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("detail.keep")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancel.mutate({ id })}>{t("detail.cancel")}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          {isDraft || campaign.status === "cancelled" ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-destructive md:h-9 md:w-fit"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id })}
            >
              {t("detail.delete")}
            </Button>
          ) : null}
        </div>
      </Section>
    </div>
  )
}
