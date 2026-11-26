"use client"

import {
  HOTEL_LANGUAGES,
  HOTEL_PLANS,
  HOTEL_STATUSES,
  type HotelLanguage,
  type HotelPlan,
  type HotelStatus,
} from "@ritorno/common/hotel"
import { errorMessage } from "@ritorno/orpc/errors"
import { orpc } from "@ritorno/orpc/react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ritorno/ui/components/alert-dialog"
import { Button } from "@ritorno/ui/components/button"
import { ConfirmDialog } from "@ritorno/ui/components/confirm-dialog"
import { StickyFormActions } from "@ritorno/ui/components/sticky-form-actions"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"
import { AdminInput, AdminSelect, ColorInput, isHex } from "@/components/admin-fields"
import { CapturePreview } from "@/components/hotel-previews"
import { logoSrc, TIMEZONES } from "@/lib/admin"

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface BrandingHotel {
  id: string
  displayName: string
  logoKey: string | null
  primaryColor: string | null
  accentColor: string | null
  replyToEmail: string | null
  defaultLanguage: HotelLanguage
  timezone: string
}

export function AdminBrandingForm({ hotel }: { hotel: BrandingHotel }) {
  const t = useTranslations("adminHotel")
  const router = useRouter()
  const [values, setValues] = useState({
    displayName: hotel.displayName,
    primaryColor: hotel.primaryColor ?? "",
    accentColor: hotel.accentColor ?? "",
    replyToEmail: hotel.replyToEmail ?? "",
    language: hotel.defaultLanguage,
    timezone: hotel.timezone,
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }))
  const blur = (key: string) => () => setTouched((current) => ({ ...current, [key]: true }))

  const errors = {
    displayName: values.displayName.trim() ? null : t("errors.displayName"),
    primaryColor: values.primaryColor && !isHex(values.primaryColor) ? t("errors.color") : null,
    accentColor: values.accentColor && !isHex(values.accentColor) ? t("errors.color") : null,
    replyToEmail: values.replyToEmail && !EMAIL.test(values.replyToEmail) ? t("errors.email") : null,
  }
  const shown = (key: keyof typeof errors) => (touched[key] ? errors[key] : null)

  const update = useMutation(
    orpc.admin.hotels.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("brandingSaved"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (Object.values(errors).some(Boolean))
      return setTouched({ displayName: true, primaryColor: true, accentColor: true, replyToEmail: true })
    update.mutate({
      id: hotel.id,
      displayName: values.displayName.trim(),
      primaryColor: values.primaryColor || null,
      accentColor: values.accentColor || null,
      replyToEmail: values.replyToEmail.trim() || null,
      defaultLanguage: values.language,
      timezone: values.timezone,
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex flex-col gap-5">
        <AdminInput
          label={t("displayName")}
          hint={t("displayNameHint")}
          error={shown("displayName")}
          value={values.displayName}
          maxLength={80}
          autoComplete="off"
          onBlur={blur("displayName")}
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
        <AdminInput
          label={t("replyTo")}
          hint={t("replyToHint")}
          error={shown("replyToEmail")}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          dir="ltr"
          value={values.replyToEmail}
          onBlur={blur("replyToEmail")}
          onChange={(event) => set("replyToEmail", event.target.value)}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <AdminSelect
            label={t("language")}
            value={values.language}
            onValueChange={(value) => set("language", value)}
            options={HOTEL_LANGUAGES.map((value) => ({ value, label: t(`languages.${value}`) }))}
          />
          <AdminSelect
            label={t("timezone")}
            value={values.timezone}
            onValueChange={(value) => set("timezone", value)}
            options={[...new Set([hotel.timezone, ...TIMEZONES])].map((value) => ({
              value,
              label: value.replace("_", " "),
            }))}
          />
        </div>
        <StickyFormActions className="md:justify-start">
          <Button type="submit" loading={update.isPending}>
            {t("save")}
          </Button>
        </StickyFormActions>
      </div>
      <div className="flex flex-col gap-3 max-xl:hidden">
        <p className="text-muted-foreground text-xs">{t("previewTitle")}</p>
        <CapturePreview
          look={{
            name: values.displayName,
            logo: logoSrc(hotel.logoKey),
            primaryColor: values.primaryColor,
            accentColor: values.accentColor,
            language: values.language,
          }}
        />
      </div>
    </form>
  )
}

const toDateInput = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "")

export function AdminPlanForm({
  hotel,
}: {
  hotel: { id: string; plan: HotelPlan; status: HotelStatus; pilotEndsAt: Date | null }
}) {
  const t = useTranslations("adminHotel")
  const router = useRouter()
  const [plan, setPlan] = useState(hotel.plan)
  const [status, setStatus] = useState(hotel.status)
  const [pilotEnd, setPilotEnd] = useState(toDateInput(hotel.pilotEndsAt))
  const update = useMutation(
    orpc.admin.hotels.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("planSaved"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const submit = (event: FormEvent) => {
    event.preventDefault()
    update.mutate({ id: hotel.id, plan, status, pilotEndsAt: pilotEnd ? new Date(`${pilotEnd}T23:59:59Z`) : null })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <AdminSelect
          label={t("plan")}
          value={plan}
          onValueChange={setPlan}
          options={HOTEL_PLANS.map((value) => ({ value, label: t(`plans.${value}`) }))}
        />
        <AdminSelect
          label={t("status")}
          value={status}
          onValueChange={setStatus}
          options={HOTEL_STATUSES.map((value) => ({ value, label: t(`statuses.${value}`) }))}
        />
      </div>
      <AdminInput
        label={t("pilotEnd")}
        hint={t("pilotEndHint")}
        type="date"
        dir="ltr"
        className="sm:max-w-xs"
        value={pilotEnd}
        onChange={(event) => setPilotEnd(event.target.value)}
      />
      <StickyFormActions className="md:justify-start">
        <Button type="submit" loading={update.isPending}>
          {t("save")}
        </Button>
      </StickyFormActions>
    </form>
  )
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Only the app admin renames a hotel. A new slug breaks printed QR codes, so it asks first. */
function AdminRename({ hotel }: { hotel: { id: string; name: string; slug: string; displayName: string } }) {
  const t = useTranslations("adminHotel")
  const tWizard = useTranslations("adminWizard")
  const router = useRouter()
  const [name, setName] = useState(hotel.name)
  const [slug, setSlug] = useState(hotel.slug)
  const [confirming, setConfirming] = useState(false)
  const rename = useMutation(
    orpc.admin.hotels.update.mutationOptions({
      onSuccess: () => {
        setConfirming(false)
        toast.success(t("renamed"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const nameError = name.trim() ? undefined : tWizard("errors.name")
  const slugError = SLUG.test(slug) ? undefined : tWizard("errors.slugFormat")
  const save = () => rename.mutate({ id: hotel.id, name: name.trim(), slug })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (nameError || slugError) return
    if (slug !== hotel.slug) setConfirming(true)
    else save()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 p-4">
      <div className="flex max-w-prose flex-col gap-1">
        <h3 className="font-medium text-sm">{t("rename")}</h3>
        <p className="text-muted-foreground text-sm">{t("renameHint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminInput label={tWizard("name")} value={name} error={nameError} onChange={(e) => setName(e.target.value)} />
        <AdminInput
          label={tWizard("slug")}
          value={slug}
          error={slugError}
          dir="ltr"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        className="self-start"
        loading={rename.isPending && !confirming}
        disabled={name === hotel.name && slug === hotel.slug}
      >
        {t("renameSave")}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("slugTitle", { hotel: hotel.displayName })}</AlertDialogTitle>
            <AlertDialogDescription>{t("slugConsequence", { old: hotel.slug })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rename.isPending}>{t("cancel")}</AlertDialogCancel>
            <Button variant="destructive" loading={rename.isPending} onClick={save}>
              {t("slugConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

export function AdminDangerZone({
  hotel,
}: {
  hotel: { id: string; name: string; slug: string; displayName: string; status: HotelStatus; hasPilotEnd: boolean }
}) {
  const t = useTranslations("adminHotel")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const suspended = hotel.status === "suspended"
  const setStatus = useMutation(
    orpc.admin.hotels.update.mutationOptions({
      onSuccess: () => {
        toast.success(suspended ? t("reactivated") : t("suspendedDone"))
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )
  const remove = useMutation(
    orpc.admin.hotels.remove.mutationOptions({
      onSuccess: () => {
        toast.success(t("deleted"))
        router.push("/admin/hotels")
        router.refresh()
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  )

  return (
    <div className="flex flex-col divide-y rounded-lg border border-destructive/30">
      <AdminRename hotel={hotel} />
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-prose flex-col gap-1">
          <h3 className="font-medium text-sm">{suspended ? t("reactivate") : t("suspend")}</h3>
          <p className="text-muted-foreground text-sm">{suspended ? t("reactivateHint") : t("suspendHint")}</p>
        </div>
        <Button
          variant="outline"
          loading={setStatus.isPending}
          onClick={() =>
            setStatus.mutate({
              id: hotel.id,
              status: suspended ? (hotel.hasPilotEnd ? "pilot" : "active") : "suspended",
            })
          }
        >
          {suspended ? t("reactivate") : t("suspend")}
        </Button>
      </div>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex max-w-prose flex-col gap-1">
          <h3 className="font-medium text-sm">{t("delete")}</h3>
          <p className="text-muted-foreground text-sm">{t("deleteHint")}</p>
        </div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          {t("delete")}
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive
        pending={remove.isPending}
        title={t("deleteTitle", { hotel: hotel.displayName })}
        description={t("deleteConsequence")}
        typedConfirmation={{ label: t("deleteType", { slug: hotel.slug }), expected: hotel.slug }}
        confirmLabel={t("deleteConfirm")}
        cancelLabel={t("cancel")}
        onConfirm={() => remove.mutate({ id: hotel.id, confirmSlug: hotel.slug })}
      />
    </div>
  )
}
