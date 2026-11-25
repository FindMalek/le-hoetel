"use client"

// i18n-used: campaigns
import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_SUBJECT_MAX,
  type Campaign,
  type CampaignChannel,
  type CampaignContent,
  type CampaignSegment,
  EMPTY_SEGMENT,
} from "@le-hoetel/common/campaigns"
import { GUEST_SOURCES } from "@le-hoetel/common/consent"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Checkbox } from "@le-hoetel/ui/components/checkbox"
import { Field, FieldDescription, FieldLabel } from "@le-hoetel/ui/components/field"
import { FormSection } from "@le-hoetel/ui/components/form-section"
import { Input } from "@le-hoetel/ui/components/input"
import { Label } from "@le-hoetel/ui/components/label"
import { StickyFormActions } from "@le-hoetel/ui/components/sticky-form-actions"
import { Textarea } from "@le-hoetel/ui/components/textarea"
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

const SELECT_CLASS =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"

const WINDOWS = [30, 90, 180, 365] as const

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

export function CampaignForm({ defaultLanguage, campaign }: { defaultLanguage: HotelLanguage; campaign?: Campaign }) {
  const t = useTranslations("campaigns")
  const tSource = useTranslations("guests")
  const router = useRouter()
  const { data: offers } = useSuspenseQuery(orpc.offers.list.queryOptions())
  const [name, setName] = useState(campaign?.name ?? "")
  const [channel, setChannel] = useState<CampaignChannel>(campaign?.channel ?? "both")
  const [content, setContent] = useState<CampaignContent>(campaign?.content ?? {})
  const [editing, setEditing] = useState<HotelLanguage>(defaultLanguage)
  const [segment, setSegment] = useState<CampaignSegment>(campaign?.segment ?? EMPTY_SEGMENT)
  const [countries, setCountries] = useState((campaign?.segment.countries ?? []).join(", "))
  const [offerId, setOfferId] = useState(campaign?.offerId ?? "")

  const fullSegment: CampaignSegment = {
    ...segment,
    countries: countries
      .split(",")
      .map((country) => country.trim())
      .filter(Boolean),
  }
  const reach = useQuery(
    orpc.campaigns.preview.queryOptions({
      input: { channel, segment: fullSegment },
      placeholderData: (previous) => previous,
    }),
  )

  const save = useMutation(
    orpc.campaigns.create.mutationOptions({
      onSuccess: (created) => router.push(`/campaigns/${created.id}`),
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const update = useMutation(
    orpc.campaigns.update.mutationOptions({
      onSuccess: (updated) => router.push(`/campaigns/${updated.id}`),
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const saving = save.isPending || update.isPending

  const text = content[editing] ?? { subject: "", body: "" }
  const setText = (patch: Partial<typeof text>) => setContent({ ...content, [editing]: { ...text, ...patch } })

  function submit(event: FormEvent) {
    event.preventDefault()
    const filled = Object.fromEntries(
      HOTEL_LANGUAGES.flatMap((language) => {
        const value = content[language]
        return value?.subject.trim() && value.body.trim() ? [[language, value]] : []
      }),
    ) as CampaignContent
    if (!Object.keys(filled).length) return void toast.error(t("form.needText"))
    const input = { name, channel, content: filled, segment: fullSegment, offerId: offerId || null }
    if (campaign) update.mutate({ id: campaign.id, ...input })
    else save.mutate(input)
  }

  return (
    <form onSubmit={submit} className="max-w-4xl">
      <FormSection title={t("form.basics")} description={t("form.basicsHint")}>
        <Field>
          <FieldLabel htmlFor="campaign-name">{t("form.name")}</FieldLabel>
          <Input
            id="campaign-name"
            className="h-11"
            required
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="campaign-channel">{t("form.channel")}</FieldLabel>
          <select
            id="campaign-channel"
            className={SELECT_CLASS}
            value={channel}
            onChange={(event) => setChannel(event.target.value as CampaignChannel)}
          >
            {CAMPAIGN_CHANNELS.map((value) => (
              <option key={value} value={value}>
                {t(`channel.${value}`)}
              </option>
            ))}
          </select>
        </Field>
      </FormSection>

      <FormSection title={t("form.message")} description={t("form.messageHint")}>
        <div role="tablist" aria-label={t("form.message")} className="flex gap-2">
          {HOTEL_LANGUAGES.map((language) => (
            <Button
              key={language}
              type="button"
              role="tab"
              aria-selected={editing === language}
              variant={editing === language ? "default" : "outline"}
              className="h-11 flex-1 md:h-9 md:flex-none"
              onClick={() => setEditing(language)}
            >
              {LOCALE_NAMES[language]}
              {content[language]?.subject ? " ✓" : ""}
            </Button>
          ))}
        </div>
        <Field>
          <FieldLabel htmlFor="campaign-subject">{t("form.subject")}</FieldLabel>
          <Input
            id="campaign-subject"
            className="h-11"
            dir={editing === "ar" ? "rtl" : "ltr"}
            maxLength={CAMPAIGN_SUBJECT_MAX}
            value={text.subject}
            onChange={(event) => setText({ subject: event.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="campaign-body">{t("form.body")}</FieldLabel>
          <Textarea
            id="campaign-body"
            rows={7}
            dir={editing === "ar" ? "rtl" : "ltr"}
            maxLength={CAMPAIGN_BODY_MAX}
            value={text.body}
            onChange={(event) => setText({ body: event.target.value })}
          />
          <FieldDescription>{t("form.bodyHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="campaign-offer">{t("form.offer")}</FieldLabel>
          <select
            id="campaign-offer"
            className={SELECT_CLASS}
            value={offerId}
            onChange={(event) => setOfferId(event.target.value)}
          >
            <option value="">{t("form.noOffer")}</option>
            {offers
              .filter((offer) => offer.active)
              .map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.title}
                </option>
              ))}
          </select>
          <FieldDescription>{t("form.offerHint")}</FieldDescription>
        </Field>
      </FormSection>

      <FormSection title={t("form.audience")} description={t("form.audienceHint")}>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium text-sm">{t("form.languages")}</legend>
          {HOTEL_LANGUAGES.map((language) => (
            <div key={language} className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox
                id={`seg-language-${language}`}
                checked={segment.languages.includes(language)}
                onCheckedChange={() => setSegment({ ...segment, languages: toggle(segment.languages, language) })}
              />
              <Label htmlFor={`seg-language-${language}`} className="font-normal">
                {LOCALE_NAMES[language]}
              </Label>
            </div>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium text-sm">{t("form.sources")}</legend>
          {GUEST_SOURCES.map((source) => (
            <div key={source} className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox
                id={`seg-source-${source}`}
                checked={segment.sources.includes(source)}
                onCheckedChange={() => setSegment({ ...segment, sources: toggle(segment.sources, source) })}
              />
              <Label htmlFor={`seg-source-${source}`} className="font-normal">
                {tSource(`source.${source}`)}
              </Label>
            </div>
          ))}
        </fieldset>
        <Field>
          <FieldLabel htmlFor="seg-countries">{t("form.countries")}</FieldLabel>
          <Input
            id="seg-countries"
            className="h-11"
            value={countries}
            onChange={(event) => setCountries(event.target.value)}
          />
          <FieldDescription>{t("form.countriesHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="seg-window">{t("form.lastVisit")}</FieldLabel>
          <select
            id="seg-window"
            className={SELECT_CLASS}
            value={segment.lastVisitDays ?? ""}
            onChange={(event) =>
              setSegment({ ...segment, lastVisitDays: event.target.value ? Number(event.target.value) : null })
            }
          >
            <option value="">{t("form.anyTime")}</option>
            {WINDOWS.map((days) => (
              <option key={days} value={days}>
                {t("form.lastDays", { days })}
              </option>
            ))}
          </select>
        </Field>
        <p className="rounded-lg border bg-muted/40 p-4 text-sm" aria-live="polite">
          {reach.data
            ? t("form.reach", { guests: reach.data.guests, email: reach.data.email, whatsapp: reach.data.whatsapp })
            : t("form.reachLoading")}
        </p>
        <p className="text-muted-foreground text-sm">{t("form.consentNote")}</p>
      </FormSection>

      <StickyFormActions>
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          render={<Link href="/campaigns" />}
          nativeButton={false}
        >
          {t("form.cancel")}
        </Button>
        <Button type="submit" className="h-11 md:h-9" disabled={saving}>
          {saving ? t("form.saving") : t("form.saveDraft")}
        </Button>
      </StickyFormActions>
    </form>
  )
}
