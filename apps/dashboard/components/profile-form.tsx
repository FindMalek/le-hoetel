"use client"

import { PROFILE_NAME_MAX } from "@le-hoetel/common/constants"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Avatar, AvatarFallback, AvatarImage } from "@le-hoetel/ui/components/avatar"
import { Button } from "@le-hoetel/ui/components/button"
import { Input } from "@le-hoetel/ui/components/input"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useRef } from "react"
import { toast } from "sonner"
import { useForm } from "@/lib/use-form"
import { FormField } from "./form-field"

export function ProfileForm({ me }: { me: { name: string; email: string; image: string | null } }) {
  const t = useTranslations("settings")
  const router = useRouter()
  const file = useRef<HTMLInputElement>(null)
  const form = useForm({ name: me.name }, (v) => (v.name.trim() ? {} : { name: t("errors.nameRequired") }))
  const onError = (error: Error) => toast.error(errorMessage(error))
  const save = useMutation(
    orpc.me.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("profileSaved"))
        router.refresh()
      },
      onError,
    }),
  )
  const avatar = useMutation(
    orpc.me.avatar.mutationOptions({
      onSuccess: () => {
        toast.success(t("pictureSaved"))
        router.refresh()
      },
      onError,
    }),
  )

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (form.submit()) save.mutate({ name: form.values.name.trim() })
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          {me.image ? <AvatarImage src={me.image} alt="" /> : null}
          <AvatarFallback className="text-xl">{me.name.trim().slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" loading={avatar.isPending} onClick={() => file.current?.click()}>
            {t("changePicture")}
          </Button>
          <p className="text-muted-foreground text-sm">{t("pictureHint")}</p>
        </div>
        <input
          ref={file}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-label={t("changePicture")}
          onChange={(event) => {
            const picked = event.target.files?.[0]
            event.target.value = ""
            if (picked) avatar.mutate({ file: picked })
          }}
        />
      </div>
      <FormField id="name" label={t("name")} error={form.error("name")}>
        {(aria) => (
          <Input
            {...aria}
            name="name"
            value={form.values.name}
            maxLength={PROFILE_NAME_MAX}
            autoComplete="name"
            enterKeyHint="done"
            onChange={(event) => form.set("name", event.target.value)}
            onBlur={() => form.blur("name")}
          />
        )}
      </FormField>
      <FormField id="email" label={t("email")} hint={t("emailHint")}>
        {(aria) => <Input {...aria} value={me.email} dir="ltr" disabled readOnly />}
      </FormField>
      <Button
        type="submit"
        className="self-start max-md:w-full"
        loading={save.isPending}
        disabled={form.values.name.trim() === me.name}
      >
        {t("save")}
      </Button>
    </form>
  )
}
