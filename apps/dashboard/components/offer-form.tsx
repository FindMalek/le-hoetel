"use client"

import { PROMO_CODE_PATTERN } from "@ritorno/common/offers"
import { type Hotel, OFFER_TEXT_MAX, OFFER_TITLE_MAX, type Offer } from "@ritorno/common/schemas"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { Field, FieldLabel } from "@ritorno/ui/components/field"
import { FormField } from "@ritorno/ui/components/form-field"
import { FormSection } from "@ritorno/ui/components/form-section"
import { Input } from "@ritorno/ui/components/input"
import { Select } from "@ritorno/ui/components/select"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { Switch } from "@ritorno/ui/components/switch"
import { Textarea } from "@ritorno/ui/components/textarea"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useForm } from "@/lib/use-form"
import { OfferCardPreview, type OfferPreviewCopies } from "./offer-card-preview"

const TRIGGERS = ["welcome", "birthday", "manual"] as const

const dayInput = (date: Date | null) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : ""
const startOfDay = (value: string) => new Date(`${value}T00:00:00`)
const endOfDay = (value: string) => new Date(`${value}T23:59:59`)

interface Values extends Record<string, unknown> {
  title: string
  text: string
  promoCode: string
  trigger: string
  validFrom: string
  validUntil: string
  maxRedemptions: string
  active: boolean
}

const initialOf = (offer: Offer | null): Values => ({
  title: offer?.title ?? "",
  text: offer?.text ?? "",
  promoCode: offer?.promoCode ?? "",
  trigger: offer?.trigger ?? "",
  validFrom: dayInput(offer?.validFrom ?? new Date()),
  validUntil: dayInput(offer?.validUntil ?? null),
  maxRedemptions: offer?.maxRedemptions == null ? "" : String(offer.maxRedemptions),
  active: offer?.active ?? true,
})

export function OfferForm({
  offer,
  hotel,
  copies,
}: {
  offer: Offer | null
  hotel: Pick<Hotel, "displayName" | "logoKey" | "primaryColor" | "accentColor" | "defaultLanguage">
  copies: OfferPreviewCopies
}) {
  const t = useTranslations("offers")
  const router = useRouter()
  const queryClient = useQueryClient()
  const form = useForm<Values>(initialOf(offer), (v) => {
    const errors: Partial<Record<keyof Values, string>> = {}
    if (!v.title.trim()) errors.title = t("errors.title")
    if (!PROMO_CODE_PATTERN.test(v.promoCode.trim().toUpperCase())) errors.promoCode = t("errors.code")
    if (!v.validFrom) errors.validFrom = t("errors.from")
    if (v.validUntil && v.validFrom && v.validUntil < v.validFrom) errors.validUntil = t("errors.until")
    if (
      v.maxRedemptions &&
      !(
        Number.isInteger(Number(v.maxRedemptions)) &&
        Number(v.maxRedemptions) >= 1 &&
        Number(v.maxRedemptions) <= 100000
      )
    ) {
      errors.maxRedemptions = t("errors.max")
    }
    return errors
  })
  const { values } = form
  const done = () => {
    toast.success(t("saved"))
    void queryClient.invalidateQueries({ queryKey: orpc.offers.key() })
    router.push("/offers")
    router.refresh()
  }
  const onError = (error: Error) => toast.error(errorMessage(error))
  const create = useMutation(orpc.offers.create.mutationOptions({ onSuccess: done, onError }))
  const update = useMutation(orpc.offers.update.mutationOptions({ onSuccess: done, onError }))
  const busy = create.isPending || update.isPending

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.submit()) return
    const input = {
      title: values.title.trim(),
      text: values.text.trim(),
      promoCode: values.promoCode.trim(),
      trigger: (values.trigger || null) as Offer["trigger"],
      validFrom: startOfDay(values.validFrom),
      validUntil: values.validUntil ? endOfDay(values.validUntil) : null,
      maxRedemptions: values.maxRedemptions ? Number(values.maxRedemptions) : null,
      active: values.active,
    }
    if (offer) update.mutate({ id: offer.id, ...input })
    else create.mutate(input)
  }

  const bind = (key: keyof Values) => ({
    name: String(key),
    value: values[key] as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      form.set(key, event.target.value as never),
    onBlur: () => form.blur(key),
  })

  const preview = (
    <OfferCardPreview
      hotel={{
        name: hotel.displayName,
        logoSrc: hotel.logoKey ? `/api/files/${hotel.logoKey}` : null,
        primaryColor: hotel.primaryColor,
        accentColor: hotel.accentColor,
        language: hotel.defaultLanguage,
      }}
      offer={{
        title: values.title.trim(),
        text: values.text.trim(),
        validFrom: values.validFrom ? startOfDay(values.validFrom) : null,
        validUntil: values.validUntil ? endOfDay(values.validUntil) : null,
      }}
      copies={copies}
    />
  )

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <form onSubmit={submit} noValidate className="flex min-w-0 flex-col">
        <FormSection title={t("sections.offer.title")} description={t("sections.offer.description")}>
          <FormField id="title" label={t("fieldTitle")} error={form.error("title")} required>
            {(aria) => (
              <Input {...aria} {...bind("title")} maxLength={OFFER_TITLE_MAX} autoComplete="off" enterKeyHint="next" />
            )}
          </FormField>
          <FormField
            id="text"
            label={t("fieldText")}
            hint={t("fieldTextHint", { max: OFFER_TEXT_MAX })}
            optional={` (${t("optional")})`}
          >
            {(aria) => <Textarea {...aria} {...bind("text")} rows={3} maxLength={OFFER_TEXT_MAX} />}
          </FormField>
          <FormField
            id="promoCode"
            label={t("fieldCode")}
            hint={t("fieldCodeHint")}
            error={form.error("promoCode")}
            required
          >
            {(aria) => (
              <Input
                {...aria}
                name="promoCode"
                value={values.promoCode}
                onChange={(event) => form.set("promoCode", event.target.value.toUpperCase())}
                onBlur={() => form.blur("promoCode")}
                dir="ltr"
                className="font-mono tracking-wider"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={24}
                enterKeyHint="next"
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title={t("sections.who.title")} description={t("sections.who.description")}>
          <FormField id="trigger" label={t("fieldTrigger")}>
            {(aria) => (
              <Select
                {...aria}
                name="trigger"
                value={values.trigger}
                onValueChange={(value) => form.set("trigger", value)}
                onBlur={() => form.blur("trigger")}
                options={[
                  { value: "", label: t("triggerNone") },
                  ...TRIGGERS.map((value) => ({ value, label: t(`trigger.${value}`) })),
                ]}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title={t("sections.when.title")} description={t("sections.when.description")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="validFrom" label={t("fieldFrom")} error={form.error("validFrom")} required>
              {(aria) => <Input {...aria} {...bind("validFrom")} type="date" />}
            </FormField>
            <FormField
              id="validUntil"
              label={t("fieldUntil")}
              hint={t("fieldUntilHint")}
              error={form.error("validUntil")}
            >
              {(aria) => <Input {...aria} {...bind("validUntil")} type="date" min={values.validFrom} />}
            </FormField>
          </div>
          <FormField
            id="maxRedemptions"
            label={t("fieldMax")}
            hint={t("fieldMaxHint")}
            error={form.error("maxRedemptions")}
          >
            {(aria) => (
              <Input
                {...aria}
                {...bind("maxRedemptions")}
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                enterKeyHint="done"
              />
            )}
          </FormField>
          <Field orientation="horizontal" className="items-start justify-between rounded-lg border p-4">
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor="active">{t("fieldActive")}</FieldLabel>
              <p className="text-muted-foreground text-sm">{t("fieldActiveHint")}</p>
            </div>
            <Switch id="active" checked={values.active} onCheckedChange={(checked) => form.set("active", checked)} />
          </Field>
          <div className="lg:hidden">{preview}</div>
        </FormSection>

        <StickyFormActions>
          <Button variant="outline" render={<Link href="/offers" />} nativeButton={false}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={busy}>
            {offer ? t("save") : t("create")}
          </Button>
        </StickyFormActions>
      </form>
      <aside className="sticky top-20 max-lg:hidden">{preview}</aside>
    </div>
  )
}
