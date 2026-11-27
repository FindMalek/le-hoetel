"use client"

// i18n-used: campaigns
import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_SUBJECT_MAX,
  type Campaign,
  type CampaignChannel,
  type CampaignContent,
  type CampaignSegment,
  EMPTY_SEGMENT,
} from "@ritorno/common/campaigns"
import { GUEST_SOURCES } from "@ritorno/common/consent"
import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Checkbox } from "@ritorno/ui/components/checkbox"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { FormField } from "@ritorno/ui/components/form-field"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { Label } from "@ritorno/ui/components/label"
import { Num } from "@ritorno/ui/components/num"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { Select } from "@ritorno/ui/components/select"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ritorno/ui/components/tabs"
import { Textarea } from "@ritorno/ui/components/textarea"
import { cn } from "@ritorno/ui/lib/utils"
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { AlertCircleIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { CampaignPreview, type CampaignPreviewCopies } from "./campaign-preview"

const WINDOWS = [30, 90, 180, 365] as const
const STEPS = ["audience", "channel", "message", "send"] as const
type Step = (typeof STEPS)[number]
const WHEN = ["draft", "now", "later"] as const
type When = (typeof WHEN)[number]

const toggle = <T,>(list: T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

const parseCountries = (value: string): string[] =>
  value
    .split(",")
    .map((country) => country.trim())
    .filter(Boolean)

/** `datetime-local` wants local time without a zone. */
export const localInput = (date: Date): string =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

/** The audience of a channel, out of one preview counted for "both". */
export const reachFor = (channel: CampaignChannel, reach: { guests: number; email: number; whatsapp: number }) =>
  channel === "both" ? reach.guests : reach[channel]

/** A card radio: the whole card is the target, the native radio keeps keyboard and forms working. */
function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  title,
  children,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors duration-150 hover:bg-surface",
        "has-checked:border-foreground has-checked:shadow-xs has-focus-visible:ring-2 has-focus-visible:ring-ring",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 accent-foreground"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{title}</span>
        {children ? <span className="text-muted-foreground text-sm">{children}</span> : null}
      </span>
    </label>
  )
}

export function CampaignForm({
  defaultLanguage,
  hotelName,
  copies,
  campaign,
}: {
  defaultLanguage: HotelLanguage
  hotelName: string
  copies: CampaignPreviewCopies
  campaign?: Campaign
}) {
  const t = useTranslations("campaigns")
  const tSource = useTranslations("guests")
  const locale = useLocale()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: offers } = useSuspenseQuery(orpc.offers.list.queryOptions())
  const [step, setStep] = useState<Step>("audience")
  const [name, setName] = useState(campaign?.name ?? "")
  const [channel, setChannel] = useState<CampaignChannel>(campaign?.channel ?? "both")
  const [content, setContent] = useState<CampaignContent>(campaign?.content ?? {})
  const [editing, setEditing] = useState<HotelLanguage>(defaultLanguage)
  const [segment, setSegment] = useState<CampaignSegment>(campaign?.segment ?? EMPTY_SEGMENT)
  const [countries, setCountries] = useState((campaign?.segment.countries ?? []).join(", "))
  const [offerId, setOfferId] = useState(campaign?.offerId ?? "")
  const [when, setWhen] = useState<When>("draft")
  const [at, setAt] = useState("")
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [attempted, setAttempted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [counted, setCounted] = useState(false)
  const [savedId, setSavedId] = useState<string | undefined>(campaign?.id)

  const fullSegment: CampaignSegment = { ...segment, countries: parseCountries(countries) }
  const reach = useQuery(
    orpc.campaigns.preview.queryOptions({
      input: { channel: "both", segment: fullSegment },
      placeholderData: (previous) => previous,
    }),
  )
  const audience = reach.data ? reachFor(channel, reach.data) : null

  const written = HOTEL_LANGUAGES.filter(
    (language) => content[language]?.subject.trim() && content[language]?.body.trim(),
  )
  const errors: Record<string, string> = {}
  if (!name.trim()) errors.name = t("errors.name")
  for (const language of HOTEL_LANGUAGES) {
    const subject = content[language]?.subject.trim() ?? ""
    const body = content[language]?.body.trim() ?? ""
    if (subject && !body) errors[`body-${language}`] = t("errors.body")
    if (body && !subject) errors[`subject-${language}`] = t("errors.subject")
  }
  if (!written.length && !errors[`body-${editing}`] && !errors[`subject-${editing}`]) {
    errors[`subject-${editing}`] = t("errors.needText")
  }
  if (when === "later") {
    if (!at) errors.at = t("errors.at")
    else if (new Date(at).getTime() < Date.now()) errors.at = t("errors.atPast")
  }
  if (when !== "draft" && audience === 0) errors.audience = t("errors.audience")

  const stepOf = (key: string): Step => (key === "at" || key === "audience" ? "send" : "message")
  const stepHasError = (value: Step) => attempted && Object.keys(errors).some((key) => stepOf(key) === value)
  const error = (key: string) => (attempted || touched.has(key) ? errors[key] : undefined)
  const blur = (key: string) => setTouched((current) => new Set(current).add(key))
  const languageHasError = (language: HotelLanguage) =>
    attempted && Boolean(errors[`subject-${language}`] || errors[`body-${language}`])

  const onError = (failure: Error) => toast.error(errorMessage(failure))
  const schedule = useMutation(orpc.campaigns.schedule.mutationOptions({ onError }))
  const create = useMutation(orpc.campaigns.create.mutationOptions({ onError }))
  const update = useMutation(orpc.campaigns.update.mutationOptions({ onError }))
  const busy = create.isPending || update.isPending || schedule.isPending

  async function save(mode: When) {
    const filled = Object.fromEntries(written.map((language) => [language, content[language]])) as CampaignContent
    const input = { name: name.trim(), channel, content: filled, segment: fullSegment, offerId: offerId || null }
    // a failed schedule after a create must not create a second draft on retry
    const saved = savedId ? await update.mutateAsync({ id: savedId, ...input }) : await create.mutateAsync(input)
    setSavedId(saved.id)
    if (mode === "draft") toast.success(t("form.savedDraft"))
    else {
      await schedule.mutateAsync({ id: saved.id, at: mode === "later" ? new Date(at) : null })
      toast.success(mode === "now" ? t("detail.sending") : t("detail.scheduled"))
    }
    await queryClient.invalidateQueries({ queryKey: orpc.campaigns.key() })
    router.push(`/campaigns/${saved.id}`)
    router.refresh()
  }

  function submit(mode: When) {
    const blocking = Object.keys(errors).filter((key) => mode !== "draft" || stepOf(key) === "message")
    if (blocking.length) {
      setAttempted(true)
      const first = STEPS.find((value) => blocking.some((key) => stepOf(key) === value))
      if (first) setStep(first)
      const language = HOTEL_LANGUAGES.find((value) => errors[`subject-${value}`] || errors[`body-${value}`])
      if (first === "message" && language) setEditing(language)
      return
    }
    if (mode === "draft") void save("draft").catch(() => undefined)
    else {
      // the count in a confirm is always fetched again for this exact audience, never a placeholder
      setCounted(false)
      setConfirming(true)
      void reach.refetch().then((result) => setCounted(result.isSuccess && !result.isPlaceholderData))
    }
  }

  const text = content[editing] ?? { subject: "", body: "" }
  const setText = (patch: Partial<typeof text>) => setContent({ ...content, [editing]: { ...text, ...patch } })
  const offerTitle = offers.find((offer) => offer.id === offerId)?.title ?? null
  const index = STEPS.indexOf(step)
  const num = (value: number) => <Num value={value} locale={locale} className="tabular-nums" />
  const guests = (value: number) => t.rich("guests", { count: value, n: () => num(value) })
  const scheduledDate = at ? new Date(at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) : ""

  const reachCard = (
    <div aria-live="polite" className="flex flex-col gap-1 rounded-xl bg-surface p-4">
      <span className="text-muted-foreground text-xs">{t("form.reachTitle")}</span>
      {reach.data ? (
        <>
          <span className="font-semibold text-h3">{guests(reachFor(channel, reach.data))}</span>
          <span className="text-muted-foreground text-sm">
            {t.rich("form.reachSplit", {
              email: () => num(reach.data.email),
              whatsapp: () => num(reach.data.whatsapp),
            })}
          </span>
          {reach.data.undated > 0 && (
            <span className="text-muted-foreground text-sm">
              {t.rich("form.undated", { count: reach.data.undated, n: () => num(reach.data.undated) })}
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground text-sm">{t("form.reachLoading")}</span>
      )}
    </div>
  )

  const preview = (
    <CampaignPreview
      hotelName={hotelName}
      channel={channel}
      language={editing}
      subject={text.subject}
      body={text.body}
      offerTitle={offerTitle}
      copies={copies}
    />
  )
  const checkCard =
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-normal has-data-checked:border-foreground"

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit(when)
        }}
        className="flex min-w-0 flex-1 flex-col gap-6"
      >
        <Tabs value={step} onValueChange={(value) => setStep(value as Step)}>
          <TabsList variant="line" className="w-full justify-start gap-1 overflow-x-auto border-b pb-1">
            {STEPS.map((value, position) => (
              <TabsTrigger key={value} value={value} className="h-11 flex-none px-2 md:px-3">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 place-items-center rounded-full bg-surface text-xs tabular-nums",
                    position <= index && "bg-foreground text-background",
                    stepHasError(value) && "bg-destructive-soft text-destructive",
                  )}
                >
                  {stepHasError(value) ? (
                    <AlertCircleIcon className="size-3.5" />
                  ) : position < index ? (
                    <CheckIcon className="size-3.5" />
                  ) : (
                    position + 1
                  )}
                </span>
                {t(`form.steps.${value}`)}
                {stepHasError(value) ? <span className="sr-only">{t("form.stepHasError")}</span> : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="audience" className="flex flex-col gap-6 pt-4">
            <p className="text-muted-foreground">{t("form.audienceHint")}</p>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium text-sm">{t("form.languages")}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {HOTEL_LANGUAGES.map((language) => (
                  <Label key={language} htmlFor={`seg-language-${language}`} className={checkCard}>
                    <Checkbox
                      id={`seg-language-${language}`}
                      checked={segment.languages.includes(language)}
                      onCheckedChange={() => setSegment({ ...segment, languages: toggle(segment.languages, language) })}
                    />
                    {LOCALE_NAMES[language]}
                  </Label>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium text-sm">{t("form.sources")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {GUEST_SOURCES.map((source) => (
                  <Label key={source} htmlFor={`seg-source-${source}`} className={checkCard}>
                    <Checkbox
                      id={`seg-source-${source}`}
                      checked={segment.sources.includes(source)}
                      onCheckedChange={() => setSegment({ ...segment, sources: toggle(segment.sources, source) })}
                    />
                    {tSource(`source.${source}`)}
                  </Label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField id="seg-countries" label={t("form.countries")} hint={t("form.countriesHint")}>
                {(aria) => <Input {...aria} value={countries} onChange={(event) => setCountries(event.target.value)} />}
              </FormField>
              <FormField id="seg-window" label={t("form.lastVisit")}>
                {(aria) => (
                  <Select
                    {...aria}
                    value={String(segment.lastVisitDays ?? "")}
                    onValueChange={(value) => setSegment({ ...segment, lastVisitDays: value ? Number(value) : null })}
                    options={[
                      { value: "", label: t("form.anyTime") },
                      ...WINDOWS.map((days) => ({ value: String(days), label: t("form.lastDays", { days }) })),
                    ]}
                  />
                )}
              </FormField>
            </div>
            <div className="lg:hidden">{reachCard}</div>
            <p className="text-muted-foreground text-sm">{t("form.consentNote")}</p>
          </TabsContent>

          <TabsContent value="channel" className="flex flex-col gap-4 pt-4">
            <p className="text-muted-foreground">{t("form.channelHint")}</p>
            <div role="radiogroup" aria-label={t("form.channel")} className="flex flex-col gap-2">
              {CAMPAIGN_CHANNELS.map((value) => (
                <ChoiceCard
                  key={value}
                  name="channel"
                  value={value}
                  checked={channel === value}
                  onChange={() => setChannel(value)}
                  title={t(`channel.${value}`)}
                >
                  {reach.data ? guests(reachFor(value, reach.data)) : t("form.reachLoading")}
                </ChoiceCard>
              ))}
            </div>
            <p className="text-muted-foreground text-sm">{t("form.consentNote")}</p>
          </TabsContent>

          <TabsContent value="message" className="flex flex-col gap-5 pt-4">
            <FormField
              id="campaign-name"
              label={t("form.name")}
              hint={t("form.nameHint")}
              error={error("name")}
              required
            >
              {(aria) => (
                <Input
                  {...aria}
                  required
                  maxLength={CAMPAIGN_NAME_MAX}
                  autoComplete="off"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => blur("name")}
                />
              )}
            </FormField>
            <div className="flex flex-col gap-2">
              <span className="font-medium text-sm">{t("form.writeIn")}</span>
              <SegmentedControl
                label={t("form.writeIn")}
                block
                value={editing}
                onValueChange={setEditing}
                options={HOTEL_LANGUAGES.map((language) => ({
                  value: language,
                  label: (
                    <>
                      {LOCALE_NAMES[language]}
                      {languageHasError(language) ? (
                        <AlertCircleIcon aria-label={t("form.stepHasError")} className="size-4 text-destructive" />
                      ) : written.includes(language) ? (
                        <CheckIcon aria-label={t("form.written")} className="size-4" />
                      ) : null}
                    </>
                  ),
                }))}
              />
              <p className="text-muted-foreground text-sm">{t("form.messageHint")}</p>
            </div>
            <FormField
              id={`campaign-subject-${editing}`}
              label={t("form.subject")}
              error={error(`subject-${editing}`)}
              hint={t("form.counter", { count: text.subject.length, max: CAMPAIGN_SUBJECT_MAX })}
            >
              {(aria) => (
                <Input
                  {...aria}
                  dir={editing === "ar" ? "rtl" : "ltr"}
                  lang={editing}
                  maxLength={CAMPAIGN_SUBJECT_MAX}
                  value={text.subject}
                  onChange={(event) => setText({ subject: event.target.value })}
                  onBlur={() => blur(`subject-${editing}`)}
                />
              )}
            </FormField>
            <FormField
              id={`campaign-body-${editing}`}
              label={t("form.body")}
              error={error(`body-${editing}`)}
              hint={t("form.bodyHint", { count: text.body.length, max: CAMPAIGN_BODY_MAX })}
            >
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={7}
                  dir={editing === "ar" ? "rtl" : "ltr"}
                  lang={editing}
                  maxLength={CAMPAIGN_BODY_MAX}
                  value={text.body}
                  onChange={(event) => setText({ body: event.target.value })}
                  onBlur={() => blur(`body-${editing}`)}
                />
              )}
            </FormField>
            <FormField id="campaign-offer" label={t("form.offer")} hint={t("form.offerHint")}>
              {(aria) => (
                <Select
                  {...aria}
                  value={offerId}
                  onValueChange={setOfferId}
                  options={[
                    { value: "", label: t("form.noOffer") },
                    ...offers.filter((offer) => offer.active).map((offer) => ({ value: offer.id, label: offer.title })),
                  ]}
                />
              )}
            </FormField>
            <div className="lg:hidden">{preview}</div>
          </TabsContent>

          <TabsContent value="send" className="flex flex-col gap-4 pt-4">
            <div role="radiogroup" aria-label={t("form.steps.send")} className="flex flex-col gap-2">
              {WHEN.map((value) => (
                <ChoiceCard
                  key={value}
                  name="when"
                  value={value}
                  checked={when === value}
                  onChange={() => setWhen(value)}
                  title={t(`form.when.${value}`)}
                >
                  {t(`form.when.${value}Hint`)}
                </ChoiceCard>
              ))}
            </div>
            {when === "later" ? (
              <FormField
                id="campaign-at"
                label={t("detail.scheduleAt")}
                error={error("at")}
                hint={t("detail.quietNote")}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    type="datetime-local"
                    dir="ltr"
                    className="md:w-72"
                    min={localInput(new Date())}
                    value={at}
                    onChange={(event) => setAt(event.target.value)}
                    onBlur={() => blur("at")}
                  />
                )}
              </FormField>
            ) : null}
            {attempted && errors.audience ? <InlineAlert tone="error" title={errors.audience} /> : null}
            <dl className="grid gap-x-6 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t("form.summary.audience")}</dt>
                <dd className="font-medium">{audience === null ? t("counting") : guests(audience)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t("form.summary.channel")}</dt>
                <dd className="font-medium">{t(`channel.${channel}`)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t("form.summary.languages")}</dt>
                <dd className="font-medium">
                  {written.length
                    ? written.map((language) => LOCALE_NAMES[language]).join(", ")
                    : t("form.summary.none")}
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{t("form.summary.offer")}</dt>
                <dd className="font-medium">{offerTitle ?? t("form.noOffer")}</dd>
              </div>
            </dl>
          </TabsContent>
        </Tabs>

        <StickyFormActions className="max-md:flex-row *:max-md:w-auto *:max-md:flex-1 *:max-md:px-2">
          {index > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep(STEPS[index - 1] ?? "audience")}>
              <ChevronLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
              {t("form.back")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              render={<Link href={campaign ? `/campaigns/${campaign.id}` : "/campaigns"} />}
              nativeButton={false}
            >
              {t("form.cancel")}
            </Button>
          )}
          {step === "send" && when !== "draft" ? null : (
            <Button
              type="button"
              variant={step === "send" ? "default" : "outline"}
              loading={busy}
              onClick={() => submit("draft")}
            >
              {t("form.saveDraft")}
            </Button>
          )}
          {step !== "send" ? (
            <Button type="button" onClick={() => setStep(STEPS[index + 1] ?? "send")}>
              {t("form.next")}
              <ChevronRightIcon data-icon="inline-end" className="rtl:rotate-180" />
            </Button>
          ) : when === "draft" ? null : (
            <Button type="submit" loading={busy}>
              {when === "now" ? t("form.reviewSend") : t("form.reviewSchedule")}
            </Button>
          )}
        </StickyFormActions>
      </form>

      <aside className="sticky top-20 flex w-88 shrink-0 flex-col gap-4 max-lg:hidden xl:w-104">
        {reachCard}
        {preview}
      </aside>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          counted && audience !== null
            ? t.rich(when === "now" ? "confirm.sendTitle" : "confirm.scheduleTitle", {
                count: audience,
                n: () => num(audience),
              })
            : t("counting")
        }
        description={
          counted && audience === 0
            ? t("errors.audience")
            : when === "now"
              ? t("confirm.sendBody", { channel: t(`channel.${channel}`) })
              : t("confirm.scheduleBody", { channel: t(`channel.${channel}`), date: scheduledDate })
        }
        confirmLabel={when === "now" ? t("detail.sendNow") : t("detail.schedule")}
        cancelLabel={t("confirm.back")}
        pending={busy}
        confirmDisabled={!counted || !audience}
        onConfirm={() => {
          void save(when)
            .catch(() => undefined)
            .finally(() => setConfirming(false))
        }}
      />
    </div>
  )
}
