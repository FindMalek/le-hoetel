"use client"

import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { QUIET_HOURS } from "@ritorno/common/hotel-time"
import type { Hotel } from "@ritorno/common/schemas"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { FormField } from "@ritorno/ui/components/form-field"
import { FormSection } from "@ritorno/ui/components/form-section"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { Input } from "@ritorno/ui/components/input"
import { SegmentedControl } from "@ritorno/ui/components/segmented-control"
import { Select } from "@ritorno/ui/components/select"
import { Switch } from "@ritorno/ui/components/switch"
import { useMutation } from "@tanstack/react-query"
import { CheckIcon, ClockIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "@/lib/use-form"
import { BrandPreview, type PreviewCopies } from "./brand-preview"
import { COLOR_DEFAULTS, ColorField, isHexColor } from "./color-field"
import { HotelLogo } from "./hotel-logo"
import { ManagerAlerts } from "./manager-alerts"

const TIMEZONES = [
  "Africa/Tunis",
  "Africa/Algiers",
  "Africa/Tripoli",
  "Africa/Casablanca",
  "Africa/Cairo",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Riyadh",
  "UTC",
]

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const HTTPS = /^https:\/\/\S+\.\S+/
const THRESHOLDS = Array.from({ length: 11 }, (_, score) => score)

type HotelPatch = Partial<
  Pick<
    Hotel,
    | "displayName"
    | "primaryColor"
    | "accentColor"
    | "defaultLanguage"
    | "timezone"
    | "replyToEmail"
    | "address"
    | "googleReviewUrl"
    | "lowScoreThreshold"
    | "weeklyDigest"
  >
>
type Errors<V> = Partial<Record<keyof V, string>>

const useHotelUpdate = () => useMutation(orpc.hotel.update.mutationOptions())

interface SectionState {
  dirty: boolean
  update: ReturnType<typeof useHotelUpdate>
  submit: (event: React.FormEvent) => void
  discard: () => void
}

/** One section of the settings: its own form and its own save, so a typo in one never blocks another. */
function useSection<V extends Record<string, unknown>>(
  initial: V,
  validate: (values: V) => Errors<V>,
  toPatch: (values: V) => HotelPatch,
) {
  const router = useRouter()
  const form = useForm<V>(initial, validate)
  const [base, setBase] = useState(initial)
  const update = useHotelUpdate()
  const dirty = (Object.keys(base) as (keyof V)[]).some((key) => base[key] !== form.values[key])
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.submit()) return
    const sent = form.values
    update.mutate(toPatch(sent), {
      onSuccess: () => {
        setBase(sent)
        router.refresh()
      },
    })
  }
  const discard = () => {
    update.reset()
    form.reset(base)
  }
  const state: SectionState = { dirty, update, submit, discard }
  return { form, state }
}

function SectionForm({
  state,
  readOnly,
  children,
}: {
  state: SectionState
  readOnly: boolean
  children: React.ReactNode
}) {
  const t = useTranslations("hotelSettings")
  const { dirty, update, submit, discard } = state
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={readOnly} className="contents">
        {children}
      </fieldset>
      {update.isError ? <InlineAlert tone="error">{errorMessage(update.error)}</InlineAlert> : null}
      {readOnly || !(dirty || update.isPending || update.isSuccess) ? null : (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p role="status" className="flex min-h-5 items-center gap-1.5 text-muted-foreground text-sm sm:me-auto">
            {update.isSuccess && !dirty ? (
              <>
                <CheckIcon aria-hidden className="size-4 text-success" />
                {t("savedInline")}
              </>
            ) : dirty ? (
              t("unsaved")
            ) : null}
          </p>
          {dirty ? (
            <Button type="button" variant="ghost" disabled={update.isPending} onClick={discard}>
              {t("discard")}
            </Button>
          ) : null}
          <Button type="submit" loading={update.isPending} disabled={!dirty}>
            {t("save")}
          </Button>
        </div>
      )}
    </form>
  )
}

function textProps<V extends Record<string, unknown>>(form: ReturnType<typeof useForm<V>>, key: keyof V & string) {
  return {
    name: key,
    value: form.values[key] as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => form.set(key, event.target.value as V[typeof key]),
    onBlur: () => form.blur(key),
  }
}

function BrandSection({ hotel, copies, readOnly }: { hotel: Hotel; copies: PreviewCopies; readOnly: boolean }) {
  const t = useTranslations("hotelSettings")
  const { form, state } = useSection(
    {
      displayName: hotel.displayName,
      primaryColor: hotel.primaryColor ?? "",
      accentColor: hotel.accentColor ?? "",
      defaultLanguage: hotel.defaultLanguage,
    },
    (v) => ({
      ...(v.displayName.trim() ? {} : { displayName: t("errors.required") }),
      ...(v.primaryColor && !isHexColor(v.primaryColor) ? { primaryColor: t("errors.color") } : {}),
      ...(v.accentColor && !isHexColor(v.accentColor) ? { accentColor: t("errors.color") } : {}),
    }),
    (v) => ({
      displayName: v.displayName.trim(),
      primaryColor: v.primaryColor || null,
      accentColor: v.accentColor || null,
      defaultLanguage: v.defaultLanguage,
    }),
  )
  const { values } = form
  const draft = {
    name: values.displayName.trim() || hotel.name,
    logoSrc: hotel.logoKey ? `/api/files/${hotel.logoKey}` : null,
    primaryColor: isHexColor(values.primaryColor) ? values.primaryColor : null,
    accentColor: isHexColor(values.accentColor) ? values.accentColor : null,
    address: hotel.address,
    language: values.defaultLanguage,
  }
  return (
    <section
      aria-labelledby="brand-title"
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <div className="flex min-w-0 max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="brand-title" className="font-heading font-semibold text-h3">
            {t("sections.brand.title")}
          </h2>
          <p className="text-pretty text-muted-foreground text-sm">{t("sections.brand.description")}</p>
        </div>
        <fieldset disabled={readOnly} className="contents">
          <HotelLogo name={draft.name} logoKey={hotel.logoKey} />
        </fieldset>
        <SectionForm state={state} readOnly={readOnly}>
          <FormField
            id="displayName"
            label={t("displayName")}
            hint={t("displayNameHint")}
            error={form.error("displayName")}
          >
            {(aria) => (
              <Input
                {...aria}
                {...textProps(form, "displayName")}
                maxLength={80}
                autoComplete="organization"
                enterKeyHint="next"
              />
            )}
          </FormField>
          <div className="grid gap-4 md:grid-cols-2">
            <ColorField
              id="primaryColor"
              label={t("primaryColor")}
              hint={t("primaryColorHint")}
              value={values.primaryColor}
              onChange={(next) => form.set("primaryColor", next)}
              onBlur={() => form.blur("primaryColor")}
              error={form.error("primaryColor")}
              fallback={COLOR_DEFAULTS.primary}
            />
            <ColorField
              id="accentColor"
              label={t("accentColor")}
              hint={t("accentColorHint")}
              value={values.accentColor}
              onChange={(next) => form.set("accentColor", next)}
              onBlur={() => form.blur("accentColor")}
              error={form.error("accentColor")}
              fallback={COLOR_DEFAULTS.accent}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm">{t("defaultLanguage")}</span>
            <SegmentedControl
              label={t("defaultLanguage")}
              block
              disabled={readOnly}
              value={values.defaultLanguage}
              onValueChange={(next) => form.set("defaultLanguage", next)}
              options={HOTEL_LANGUAGES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
            />
            <p className="text-muted-foreground text-sm">{t("defaultLanguageHint")}</p>
          </div>
        </SectionForm>
      </div>
      <BrandPreview draft={draft} copies={copies} className="lg:sticky lg:top-20" />
    </section>
  )
}

function MessagingSection({ hotel, readOnly }: { hotel: Hotel; readOnly: boolean }) {
  const t = useTranslations("hotelSettings")
  const { form, state } = useSection(
    { replyToEmail: hotel.replyToEmail ?? "", address: hotel.address ?? "", timezone: hotel.timezone },
    (v) => (v.replyToEmail && !EMAIL.test(v.replyToEmail.trim()) ? { replyToEmail: t("errors.email") } : {}),
    (v) => ({ replyToEmail: v.replyToEmail.trim() || null, address: v.address.trim() || null, timezone: v.timezone }),
  )
  const timezones = TIMEZONES.includes(form.values.timezone) ? TIMEZONES : [form.values.timezone, ...TIMEZONES]
  const hour = (value: number) => `${String(value).padStart(2, "0")}:00`
  return (
    <FormSection title={t("sections.messaging.title")} description={t("sections.messaging.description")}>
      <SectionForm state={state} readOnly={readOnly}>
        <FormField
          id="replyToEmail"
          label={t("replyTo")}
          hint={t("replyToHint")}
          error={form.error("replyToEmail")}
          optional={t("optional")}
        >
          {(aria) => (
            <Input
              {...aria}
              {...textProps(form, "replyToEmail")}
              type="email"
              dir="ltr"
              inputMode="email"
              autoComplete="off"
              enterKeyHint="next"
            />
          )}
        </FormField>
        <FormField id="address" label={t("address")} hint={t("addressHint")} optional={t("optional")}>
          {(aria) => (
            <Input
              {...aria}
              {...textProps(form, "address")}
              maxLength={200}
              autoComplete="street-address"
              enterKeyHint="next"
            />
          )}
        </FormField>
        <FormField id="timezone" label={t("timezone")} hint={t("timezoneHint")}>
          {(aria) => (
            <Select
              {...aria}
              value={form.values.timezone}
              onValueChange={(value) => form.set("timezone", value)}
              options={timezones.map((zone) => ({ value: zone, label: zone.replace("_", " ") }))}
            />
          )}
        </FormField>
        <div className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
          <ClockIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("quietHours")}</span>
            <span className="text-pretty text-muted-foreground">
              {t.rich("quietHoursText", {
                from: () => <bdi dir="ltr">{hour(QUIET_HOURS.from)}</bdi>,
                until: () => <bdi dir="ltr">{hour(QUIET_HOURS.until)}</bdi>,
              })}
            </span>
          </div>
        </div>
      </SectionForm>
    </FormSection>
  )
}

function AlertsSection({ hotel, readOnly }: { hotel: Hotel; readOnly: boolean }) {
  const t = useTranslations("hotelSettings")
  const { form, state } = useSection(
    { lowScoreThreshold: String(hotel.lowScoreThreshold) },
    () => ({}),
    (v) => ({ lowScoreThreshold: Number(v.lowScoreThreshold) }),
  )
  return (
    <FormSection title={t("sections.alerts.title")} description={t("sections.alerts.description")}>
      <ManagerAlerts readOnly={readOnly} />
      <SectionForm state={state} readOnly={readOnly}>
        <FormField id="lowScoreThreshold" label={t("threshold")} hint={t("thresholdHint")}>
          {(aria) => (
            <Select
              {...aria}
              value={form.values.lowScoreThreshold}
              onValueChange={(value) => form.set("lowScoreThreshold", value)}
              options={THRESHOLDS.map((score) => ({ value: String(score), label: t("thresholdOption", { score }) }))}
            />
          )}
        </FormField>
      </SectionForm>
    </FormSection>
  )
}

function DigestSection({ hotel, readOnly }: { hotel: Hotel; readOnly: boolean }) {
  const t = useTranslations("hotelSettings")
  const { form, state } = useSection(
    { weeklyDigest: hotel.weeklyDigest },
    () => ({}),
    (v) => v,
  )
  return (
    <FormSection
      id="weekly-digest"
      className="scroll-mt-20"
      title={t("sections.digest.title")}
      description={t("sections.digest.description")}
    >
      <SectionForm state={state} readOnly={readOnly}>
        <label htmlFor="weeklyDigest" className="flex min-h-11 items-center justify-between gap-4">
          <span className="flex flex-col gap-1">
            <span className="font-medium text-sm">{t("weeklyDigest")}</span>
            <span className="text-pretty text-muted-foreground text-sm">{t("weeklyDigestHint")}</span>
          </span>
          <Switch
            id="weeklyDigest"
            checked={form.values.weeklyDigest}
            disabled={readOnly}
            onCheckedChange={(checked) => form.set("weeklyDigest", checked)}
          />
        </label>
      </SectionForm>
    </FormSection>
  )
}

function ReviewSection({ hotel, readOnly }: { hotel: Hotel; readOnly: boolean }) {
  const t = useTranslations("hotelSettings")
  const { form, state } = useSection(
    { googleReviewUrl: hotel.googleReviewUrl ?? "" },
    (v) =>
      v.googleReviewUrl.trim() && !HTTPS.test(v.googleReviewUrl.trim()) ? { googleReviewUrl: t("errors.https") } : {},
    (v) => ({ googleReviewUrl: v.googleReviewUrl.trim() || null }),
  )
  return (
    <FormSection title={t("sections.review.title")} description={t("sections.review.description")}>
      <SectionForm state={state} readOnly={readOnly}>
        <FormField
          id="googleReviewUrl"
          label={t("reviewUrl")}
          hint={t("reviewUrlHint")}
          error={form.error("googleReviewUrl")}
          optional={t("optional")}
        >
          {(aria) => (
            <Input
              {...aria}
              {...textProps(form, "googleReviewUrl")}
              type="url"
              dir="ltr"
              inputMode="url"
              placeholder="https://g.page/r/…"
              autoComplete="off"
              enterKeyHint="done"
            />
          )}
        </FormField>
      </SectionForm>
    </FormSection>
  )
}

/** Hotel settings as independent sections: each one saves only its own fields. */
export function HotelSettingsForm({
  hotel,
  copies,
  readOnly,
}: {
  hotel: Hotel
  copies: PreviewCopies
  readOnly: boolean
}) {
  const t = useTranslations("hotelSettings")
  return (
    <div className="flex flex-col gap-10">
      {readOnly ? <InlineAlert tone="info">{t("readOnly")}</InlineAlert> : null}
      <BrandSection hotel={hotel} copies={copies} readOnly={readOnly} />
      <div className="flex flex-col border-t pt-6">
        <MessagingSection hotel={hotel} readOnly={readOnly} />
        <AlertsSection hotel={hotel} readOnly={readOnly} />
        <DigestSection hotel={hotel} readOnly={readOnly} />
        <ReviewSection hotel={hotel} readOnly={readOnly} />
      </div>
    </div>
  )
}
