"use client"

import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import { Button } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { cn } from "@ritorno/ui/lib/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, CheckIcon, LoaderCircleIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { AdminInput, AdminSelect, ColorInput, isHex } from "@/components/admin-fields"
import { CapturePreview, InvitePreview } from "@/components/hotel-previews"
import { slugOf, TIMEZONES } from "@/lib/admin"

const STEPS = ["basics", "branding", "languages", "owner"] as const
type Step = (typeof STEPS)[number]

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Values {
  name: string
  slug: string
  slugTouched: boolean
  displayName: string
  primaryColor: string
  accentColor: string
  language: HotelLanguage
  timezone: string
  ownerEmail: string
}

const INITIAL: Values = {
  name: "",
  slug: "",
  slugTouched: false,
  displayName: "",
  primaryColor: "#0a7c66",
  accentColor: "#f2b134",
  language: "fr",
  timezone: "Africa/Tunis",
  ownerEmail: "",
}

type Errors = Partial<Record<"name" | "slug" | "primaryColor" | "accentColor" | "ownerEmail", string>>

export function AdminHotelWizard() {
  const t = useTranslations("adminWizard")
  const tHotel = useTranslations("adminHotel")
  const router = useRouter()
  const [step, setStep] = useState<Step>("basics")
  const [values, setValues] = useState<Values>(INITIAL)
  const [touched, setTouched] = useState<Partial<Record<keyof Errors, boolean>>>({})
  const [slugToCheck, setSlugToCheck] = useState("")
  const index = STEPS.indexOf(step)
  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    const slug = values.slug
    if (!SLUG.test(slug)) return void setSlugToCheck("")
    const timer = setTimeout(() => setSlugToCheck(slug), 350)
    return () => clearTimeout(timer)
  }, [values.slug])

  const availability = useQuery({
    ...orpc.admin.hotels.slugAvailable.queryOptions({ input: { slug: slugToCheck } }),
    enabled: slugToCheck !== "" && slugToCheck === values.slug,
  })
  const checking = SLUG.test(values.slug) && (slugToCheck !== values.slug || availability.isFetching)
  const taken = slugToCheck === values.slug && availability.data?.available === false

  const errors: Errors = {}
  if (!values.name.trim()) errors.name = t("errors.name")
  if (!values.slug) errors.slug = t("errors.slug")
  else if (!SLUG.test(values.slug)) errors.slug = t("errors.slugFormat")
  else if (taken) errors.slug = t("errors.slugTaken")
  if (values.primaryColor && !isHex(values.primaryColor)) errors.primaryColor = t("errors.color")
  if (values.accentColor && !isHex(values.accentColor)) errors.accentColor = t("errors.color")
  if (!EMAIL.test(values.ownerEmail)) errors.ownerEmail = t("errors.email")

  const stepFields: Record<Step, (keyof Errors)[]> = {
    basics: ["name", "slug"],
    branding: ["primaryColor", "accentColor"],
    languages: [],
    owner: ["ownerEmail"],
  }
  const shown = (field: keyof Errors) => (touched[field] || (field === "slug" && taken) ? errors[field] : undefined)
  const blur = (field: keyof Errors) => () => setTouched((current) => ({ ...current, [field]: true }))
  const stepValid = (current: Step) =>
    stepFields[current].every((field) => !errors[field]) && !(current === "basics" && checking)

  const create = useMutation(
    orpc.admin.hotels.create.mutationOptions({
      onSuccess: (hotel) => {
        toast.success(t("created"))
        router.push(`/admin/hotels/${hotel.id}`)
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const touchStep = () =>
    setTouched((current) => ({ ...current, ...Object.fromEntries(stepFields[step].map((field) => [field, true])) }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!stepValid(step)) return touchStep()
    if (step !== "owner") return setStep(STEPS[index + 1] ?? "owner")
    create.mutate({
      name: values.name.trim(),
      slug: values.slug,
      ownerEmail: values.ownerEmail.trim(),
      displayName: values.displayName.trim() || undefined,
      primaryColor: values.primaryColor || undefined,
      accentColor: values.accentColor || undefined,
      defaultLanguage: values.language,
      timezone: values.timezone,
    })
  }

  const look = {
    name: values.displayName.trim() || values.name,
    primaryColor: values.primaryColor,
    accentColor: values.accentColor,
    language: values.language,
  }

  const slugHint = checking
    ? t("slugChecking")
    : SLUG.test(values.slug) && !taken && slugToCheck === values.slug
      ? t("slugFree", { slug: values.slug })
      : t("slugHint")

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-12">
      <div className="flex flex-col gap-6">
        <nav aria-label={t("steps")}>
          <p className="text-muted-foreground text-sm md:hidden" aria-live="polite">
            {t("stepOf", { current: index + 1, total: STEPS.length })} · {t(`step.${step}.title`)}
          </p>
          <ol className="mt-2 flex gap-2 md:mt-0">
            {STEPS.map((item, position) => (
              <li
                key={item}
                aria-current={item === step ? "step" : undefined}
                className={cn(
                  "flex flex-1 flex-col gap-2 md:flex-row md:items-center md:gap-3",
                  position > index && "text-muted-foreground",
                )}
              >
                <span
                  className={cn("h-1 rounded-full md:hidden", position <= index ? "bg-primary" : "bg-border")}
                  aria-hidden
                />
                <span
                  className={cn(
                    "max-md:hidden grid size-7 shrink-0 place-items-center rounded-full border font-medium text-xs tabular-nums",
                    position < index && "border-primary bg-primary text-primary-foreground",
                    position === index && "border-primary text-primary",
                  )}
                  aria-hidden
                >
                  {position < index ? <CheckIcon className="size-3.5" /> : position + 1}
                </span>
                <span className="max-md:sr-only truncate font-medium text-sm">{t(`step.${item}.title`)}</span>
              </li>
            ))}
          </ol>
        </nav>

        <section className="flex max-w-xl flex-col gap-5" aria-labelledby="wizard-step-title">
          <div className="flex flex-col gap-1">
            <h2 id="wizard-step-title" className="text-h3">
              {t(`step.${step}.title`)}
            </h2>
            <p className="text-pretty text-muted-foreground">{t(`step.${step}.description`)}</p>
          </div>

          {step === "basics" && (
            <>
              <AdminInput
                label={t("name")}
                hint={t("nameHint")}
                required
                error={shown("name")}
                value={values.name}
                maxLength={80}
                autoComplete="off"
                enterKeyHint="next"
                onBlur={blur("name")}
                onChange={(event) => {
                  const name = event.target.value
                  setValues((current) => ({
                    ...current,
                    name,
                    slug: current.slugTouched ? current.slug : slugOf(name),
                  }))
                }}
              />
              <div className="flex flex-col gap-1.5">
                <AdminInput
                  label={t("slug")}
                  hint={slugHint}
                  required
                  error={shown("slug")}
                  value={values.slug}
                  maxLength={60}
                  dir="ltr"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  onBlur={blur("slug")}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, slug: event.target.value.toLowerCase(), slugTouched: true }))
                  }
                />
                <p className="flex items-center gap-1.5 text-muted-foreground text-xs" aria-live="polite">
                  {checking ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
                  ) : SLUG.test(values.slug) && !taken && slugToCheck === values.slug ? (
                    <CheckCircle2Icon className="size-3.5 text-success" aria-hidden />
                  ) : null}
                  <span dir="ltr" className="truncate">
                    /h/{values.slug || "…"}
                  </span>
                </p>
              </div>
            </>
          )}

          {step === "branding" && (
            <>
              <AdminInput
                label={t("displayName")}
                hint={t("displayNameHint")}
                value={values.displayName}
                placeholder={values.name}
                maxLength={80}
                autoComplete="off"
                onChange={(event) => set("displayName", event.target.value)}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <ColorInput
                  label={t("primaryColor")}
                  value={values.primaryColor}
                  placeholder="#0a7c66"
                  error={shown("primaryColor")}
                  onChange={(value) => {
                    set("primaryColor", value)
                    blur("primaryColor")()
                  }}
                />
                <ColorInput
                  label={t("accentColor")}
                  value={values.accentColor}
                  placeholder="#f2b134"
                  error={shown("accentColor")}
                  onChange={(value) => {
                    set("accentColor", value)
                    blur("accentColor")()
                  }}
                />
              </div>
              <InlineAlert tone="info">{t("logoLater")}</InlineAlert>
            </>
          )}

          {step === "languages" && (
            <>
              <AdminSelect
                label={t("language")}
                hint={t("languageHint")}
                value={values.language}
                onValueChange={(value) => set("language", value)}
                options={HOTEL_LANGUAGES.map((value) => ({ value, label: tHotel(`languages.${value}`) }))}
              />
              <AdminSelect
                label={t("timezone")}
                hint={t("timezoneHint")}
                value={values.timezone}
                onValueChange={(value) => set("timezone", value)}
                options={TIMEZONES.map((value) => ({ value, label: value.replace("_", " ") }))}
              />
            </>
          )}

          {step === "owner" && (
            <>
              <AdminInput
                label={t("ownerEmail")}
                hint={t("ownerHint")}
                required
                error={shown("ownerEmail")}
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                enterKeyHint="done"
                dir="ltr"
                value={values.ownerEmail}
                onBlur={blur("ownerEmail")}
                onChange={(event) => set("ownerEmail", event.target.value)}
              />
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t pt-4 text-sm">
                <dt className="text-muted-foreground">{t("name")}</dt>
                <dd className="font-medium">{values.name}</dd>
                <dt className="text-muted-foreground">{t("slug")}</dt>
                <dd dir="ltr" className="text-start">
                  {values.slug}
                </dd>
                <dt className="text-muted-foreground">{t("language")}</dt>
                <dd>{tHotel(`languages.${values.language}`)}</dd>
              </dl>
              <p className="text-pretty text-muted-foreground text-sm">{t("afterCreate")}</p>
            </>
          )}
        </section>

        <StickyFormActions className="md:justify-start">
          <Button type="submit" loading={create.isPending} disabled={create.isPending}>
            {step === "owner" ? t("create") : t("next")}
            {step !== "owner" && <ArrowRightIcon data-icon="inline-end" className="rtl:rotate-180" />}
          </Button>
          {index > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(STEPS[index - 1] ?? "basics")}>
              <ArrowLeftIcon data-icon="inline-start" className="rtl:rotate-180" />
              {t("back")}
            </Button>
          )}
        </StickyFormActions>
      </div>

      <aside
        className={cn("lg:sticky lg:top-20 lg:self-start", step === "basics" && "max-lg:hidden")}
        aria-label={t("preview")}
      >
        <p className="mb-3 text-center text-muted-foreground text-xs lg:text-start">
          {step === "owner" ? t("previewInvite") : t("previewCapture")}
        </p>
        {step === "owner" ? <InvitePreview look={look} email={values.ownerEmail} /> : <CapturePreview look={look} />}
      </aside>
    </form>
  )
}
