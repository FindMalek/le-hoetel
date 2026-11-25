"use client"

import { HOTEL_LANGUAGES, type HotelLanguage } from "@le-hoetel/common/hotel"
import type { Hotel } from "@le-hoetel/common/schemas"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { FormSection } from "@le-hoetel/ui/components/form-section"
import { InlineAlert } from "@le-hoetel/ui/components/inline-alert"
import { Input } from "@le-hoetel/ui/components/input"
import { StickyFormActions } from "@le-hoetel/ui/components/sticky-form-actions"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useForm } from "@/lib/use-form"
import { BrandPreview, type PreviewCopies } from "./brand-preview"
import { ColorField, isHexColor } from "./color-field"
import { FormField } from "./form-field"
import { HotelLogo } from "./hotel-logo"
import { NativeSelect } from "./native-select"

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
const PHONE = /^\+[1-9]\d{7,14}$/

interface Values extends Record<string, unknown> {
  displayName: string
  primaryColor: string
  accentColor: string
  defaultLanguage: HotelLanguage
  timezone: string
  replyToEmail: string
  address: string
  googleReviewUrl: string
  managerWhatsapp: string
  managerTelegram: string
}

const valuesOf = (hotel: Hotel): Values => ({
  displayName: hotel.displayName,
  primaryColor: hotel.primaryColor ?? "",
  accentColor: hotel.accentColor ?? "",
  defaultLanguage: hotel.defaultLanguage,
  timezone: hotel.timezone,
  replyToEmail: hotel.replyToEmail ?? "",
  address: hotel.address ?? "",
  googleReviewUrl: hotel.googleReviewUrl ?? "",
  managerWhatsapp: hotel.managerWhatsapp ?? "",
  managerTelegram: hotel.managerTelegram ?? "",
})

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
  const router = useRouter()
  const initial = valuesOf(hotel)
  const form = useForm<Values>(initial, (v) => {
    const errors: Partial<Record<keyof Values, string>> = {}
    if (!v.displayName.trim()) errors.displayName = t("errors.required")
    if (v.primaryColor && !isHexColor(v.primaryColor)) errors.primaryColor = t("errors.color")
    if (v.accentColor && !isHexColor(v.accentColor)) errors.accentColor = t("errors.color")
    if (v.replyToEmail && !EMAIL.test(v.replyToEmail)) errors.replyToEmail = t("errors.email")
    if (v.googleReviewUrl && !/^https:\/\/\S+\.\S+/.test(v.googleReviewUrl)) errors.googleReviewUrl = t("errors.https")
    if (v.managerWhatsapp && !PHONE.test(v.managerWhatsapp.replace(/[\s-]/g, "")))
      errors.managerWhatsapp = t("errors.phone")
    return errors
  })
  const { values } = form
  const dirty = (Object.keys(initial) as (keyof Values)[]).some((key) => initial[key] !== values[key])

  const update = useMutation(
    orpc.hotel.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("saved"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.submit()) return
    update.mutate({
      displayName: values.displayName.trim(),
      primaryColor: values.primaryColor || null,
      accentColor: values.accentColor || null,
      defaultLanguage: values.defaultLanguage,
      timezone: values.timezone,
      replyToEmail: values.replyToEmail.trim() || null,
      address: values.address.trim() || null,
      googleReviewUrl: values.googleReviewUrl.trim() || null,
      managerWhatsapp: values.managerWhatsapp.replace(/[\s-]/g, "") || null,
      managerTelegram: values.managerTelegram.trim() || null,
    })
  }

  const text = (key: keyof Values) => ({
    name: key,
    value: values[key] as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => form.set(key, event.target.value as never),
    onBlur: () => form.blur(key),
  })

  const draft = {
    name: values.displayName.trim() || hotel.name,
    logoSrc: hotel.logoKey ? `/api/files/${hotel.logoKey}` : null,
    primaryColor: isHexColor(values.primaryColor) ? values.primaryColor : null,
    accentColor: isHexColor(values.accentColor) ? values.accentColor : null,
    address: values.address.trim() || null,
    language: values.defaultLanguage,
  }
  const timezones = TIMEZONES.includes(values.timezone) ? TIMEZONES : [values.timezone, ...TIMEZONES]

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <form onSubmit={submit} noValidate className="flex min-w-0 flex-col">
        {readOnly ? (
          <InlineAlert tone="info" className="mb-6">
            {t("readOnly")}
          </InlineAlert>
        ) : null}
        <fieldset disabled={readOnly} className="contents">
          <FormSection title={t("sections.identity.title")} description={t("sections.identity.description")}>
            <FormField
              id="displayName"
              label={t("displayName")}
              hint={t("displayNameHint")}
              error={form.error("displayName")}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...text("displayName")}
                  maxLength={80}
                  autoComplete="organization"
                  enterKeyHint="next"
                />
              )}
            </FormField>
            <HotelLogo name={values.displayName || hotel.name} logoKey={hotel.logoKey} />
          </FormSection>

          <FormSection title={t("sections.brand.title")} description={t("sections.brand.description")}>
            <ColorField
              id="primaryColor"
              label={t("primaryColor")}
              hint={t("primaryColorHint")}
              value={values.primaryColor}
              onChange={(next) => form.set("primaryColor", next)}
              onBlur={() => form.blur("primaryColor")}
              error={form.error("primaryColor")}
              fallback="#0a7c66"
            />
            <ColorField
              id="accentColor"
              label={t("accentColor")}
              hint={t("accentColorHint")}
              value={values.accentColor}
              onChange={(next) => form.set("accentColor", next)}
              onBlur={() => form.blur("accentColor")}
              error={form.error("accentColor")}
              fallback="#f2b134"
            />
            <BrandPreview draft={draft} copies={copies} className="lg:hidden" />
          </FormSection>

          <FormSection title={t("sections.language.title")} description={t("sections.language.description")}>
            <FormField id="defaultLanguage" label={t("defaultLanguage")} hint={t("defaultLanguageHint")}>
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={values.defaultLanguage}
                  onChange={(event) => form.set("defaultLanguage", event.target.value as HotelLanguage)}
                >
                  {HOTEL_LANGUAGES.map((value) => (
                    <option key={value} value={value}>
                      {LOCALE_NAMES[value]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="timezone" label={t("timezone")} hint={t("timezoneHint")}>
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={values.timezone}
                  onChange={(event) => form.set("timezone", event.target.value)}
                >
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace("_", " ")}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </FormSection>

          <FormSection title={t("sections.contact.title")} description={t("sections.contact.description")}>
            <FormField
              id="replyToEmail"
              label={t("replyTo")}
              hint={t("replyToHint")}
              error={form.error("replyToEmail")}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...text("replyToEmail")}
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="off"
                  enterKeyHint="next"
                />
              )}
            </FormField>
            <FormField id="address" label={t("address")} hint={t("addressHint")} error={form.error("address")}>
              {(aria) => (
                <Input
                  {...aria}
                  {...text("address")}
                  maxLength={200}
                  autoComplete="street-address"
                  enterKeyHint="next"
                />
              )}
            </FormField>
            <FormField
              id="googleReviewUrl"
              label={t("reviewUrl")}
              hint={t("reviewUrlHint")}
              error={form.error("googleReviewUrl")}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...text("googleReviewUrl")}
                  type="url"
                  dir="ltr"
                  inputMode="url"
                  placeholder="https://"
                  autoComplete="off"
                  enterKeyHint="next"
                />
              )}
            </FormField>
          </FormSection>

          <FormSection title={t("sections.alerts.title")} description={t("sections.alerts.description")}>
            <FormField
              id="managerWhatsapp"
              label={t("whatsapp")}
              hint={t("whatsappHint")}
              error={form.error("managerWhatsapp")}
            >
              {(aria) => (
                <Input
                  {...aria}
                  {...text("managerWhatsapp")}
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  placeholder="+216 20 123 456"
                  autoComplete="off"
                  enterKeyHint="next"
                />
              )}
            </FormField>
            <FormField id="managerTelegram" label={t("telegram")} hint={t("telegramHint")} optional={t("optional")}>
              {(aria) => (
                <Input
                  {...aria}
                  {...text("managerTelegram")}
                  dir="ltr"
                  maxLength={80}
                  autoComplete="off"
                  enterKeyHint="done"
                />
              )}
            </FormField>
          </FormSection>
        </fieldset>
        {readOnly ? null : (
          <StickyFormActions>
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || update.isPending}
              onClick={() => form.reset(initial)}
            >
              {t("discard")}
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!dirty}>
              {t("save")}
            </Button>
          </StickyFormActions>
        )}
      </form>
      <aside className="sticky top-20 max-lg:hidden">
        <BrandPreview draft={draft} copies={copies} />
      </aside>
    </div>
  )
}
