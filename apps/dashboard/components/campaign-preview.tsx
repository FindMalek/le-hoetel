"use client"

// i18n-used: campaigns
import type { CampaignChannel } from "@ritorno/common/campaigns"
import type { HotelLanguage } from "@ritorno/common/hotel"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { GiftIcon, MailIcon, MessageCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

export interface CampaignPreviewCopy {
  offer: string
  unsubscribe: string
  stop: string
}
export type CampaignPreviewCopies = Record<HotelLanguage, CampaignPreviewCopy>

type View = "email" | "whatsapp"

/** The message as a guest gets it, in the language being written: an email card, a WhatsApp bubble, or both. */
export function CampaignPreview({
  title,
  extra,
  hotelName,
  channel,
  language,
  subject,
  body,
  offerTitle,
  copies,
}: {
  title?: string
  /** Controls next to the channel switch, such as a language picker. */
  extra?: React.ReactNode
  hotelName: string
  channel: CampaignChannel
  language: HotelLanguage
  subject: string
  body: string
  offerTitle: string | null
  copies: CampaignPreviewCopies
}) {
  const t = useTranslations("campaigns.preview")
  const [picked, setPicked] = useState<View>("email")
  const view: View = channel === "both" ? picked : channel
  const copy = copies[language]
  const shownSubject = subject.trim() || t("subjectPlaceholder")
  const shownBody = body.trim() || t("bodyPlaceholder")
  const offer = offerTitle ? (
    <p className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
      <GiftIcon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-muted-foreground text-xs">{copy.offer}</span>
        <span className="font-medium">{offerTitle}</span>
      </span>
    </p>
  ) : null

  return (
    <section aria-labelledby="campaign-preview-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="campaign-preview-title" className="font-semibold text-base">
          {title ?? t("title")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {extra}
          {channel === "both" ? (
            <SegmentedControl
              label={t("viewLabel")}
              value={view}
              onValueChange={setPicked}
              options={[
                { value: "email", label: t("email") },
                { value: "whatsapp", label: t("whatsapp") },
              ]}
            />
          ) : null}
        </div>
      </div>
      <div
        lang={language}
        dir={language === "ar" ? "rtl" : "ltr"}
        className="rounded-2xl bg-surface p-3 md:p-4"
        role="img"
        aria-label={t("label")}
      >
        {view === "email" ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-background p-4">
            <div className="flex items-center gap-2 border-b pb-3 text-muted-foreground text-xs">
              <MailIcon aria-hidden className="size-4" />
              <span className="truncate font-medium text-foreground">{hotelName}</span>
            </div>
            <p className="text-balance break-words font-semibold text-lg leading-snug">{shownSubject}</p>
            <p className="whitespace-pre-line break-words text-sm leading-relaxed">{shownBody}</p>
            {offer}
            <p className="border-t pt-3 text-center text-muted-foreground text-xs underline">{copy.unsubscribe}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-muted-foreground text-xs">
              <MessageCircleIcon aria-hidden className="size-4" />
              <span className="font-medium text-foreground">{hotelName}</span>
            </p>
            <div className="flex me-8 flex-col gap-2 rounded-2xl rounded-ss-sm border bg-background p-3 shadow-xs">
              <p className="break-words font-semibold text-sm">{shownSubject}</p>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed">{shownBody}</p>
              {offer}
              <p className="text-muted-foreground text-xs">{copy.stop}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
