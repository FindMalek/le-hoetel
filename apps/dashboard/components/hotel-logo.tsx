"use client"

import { LOGO_MAX_BYTES, LOGO_TYPES } from "@le-hoetel/common/hotel"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { type ChangeEvent, useRef, useState } from "react"
import { toast } from "sonner"

export function HotelLogo({ name, logoKey }: { name: string; logoKey: string | null }) {
  const t = useTranslations("hotelSettings")
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const uploadUrl = useMutation(orpc.hotel.logo.uploadUrl.mutationOptions())
  const setLogo = useMutation(orpc.hotel.logo.set.mutationOptions())
  const removeLogo = useMutation(orpc.hotel.logo.remove.mutationOptions())

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!LOGO_TYPES[file.type] || file.size > LOGO_MAX_BYTES) return void toast.error(t("invalidFile"))
    setBusy(true)
    try {
      const target = await uploadUrl.mutateAsync({ type: file.type, size: file.size })
      const put = await fetch(target.url, { method: "PUT", headers: target.headers, body: file })
      if (!put.ok) throw new Error("upload failed")
      await setLogo.mutateAsync({ key: target.key })
      toast.success(t("logoSaved"))
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await removeLogo.mutateAsync({})
      toast.success(t("logoRemoved"))
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="font-medium text-sm">{t("logo")}</span>
      <div className="flex items-center gap-4">
        {logoKey ? (
          // biome-ignore lint/performance/noImgElement: a private redirecting url, next/image can't optimize it
          <img src={`/api/files/${logoKey}`} alt={name} className="size-20 shrink-0 rounded-lg border bg-card object-contain p-1" />
        ) : (
          <span
            aria-hidden
            className="grid size-20 shrink-0 place-items-center rounded-lg border border-dashed bg-muted font-heading font-semibold text-2xl text-muted-foreground"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" loading={busy} onClick={() => picker.current?.click()}>
              {logoKey ? t("replace") : t("upload")}
            </Button>
            {logoKey ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={remove}>
                {t("remove")}
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">{t("logoHint")}</p>
        </div>
      </div>
      <input
        ref={picker}
        type="file"
        accept={Object.keys(LOGO_TYPES).join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label={t("upload")}
        onChange={upload}
      />
    </div>
  )
}
