"use client"

import { LOGO_MAX_BYTES, LOGO_TYPES } from "@le-hoetel/common/hotel"
import { errorMessage } from "@le-hoetel/orpc/errors"
import { orpc } from "@le-hoetel/orpc/react"
import { Button } from "@le-hoetel/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { type ChangeEvent, useRef, useState } from "react"
import { toast } from "sonner"

interface Labels {
  logo: string
  hint: string
  upload: string
  remove: string
  saved: string
  removed: string
  invalidFile: string
}

export function HotelLogo({ name, logoKey, labels }: { name: string; logoKey: string | null; labels: Labels }) {
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
    if (!LOGO_TYPES[file.type] || file.size > LOGO_MAX_BYTES) return void toast.error(labels.invalidFile)
    setBusy(true)
    try {
      const target = await uploadUrl.mutateAsync({ type: file.type, size: file.size })
      const put = await fetch(target.url, { method: "PUT", headers: target.headers, body: file })
      if (!put.ok) throw new Error("upload failed")
      await setLogo.mutateAsync({ key: target.key })
      toast.success(labels.saved)
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
      toast.success(labels.removed)
      router.refresh()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.logo}</CardTitle>
        <CardDescription>{labels.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        {logoKey ? (
          // biome-ignore lint/performance/noImgElement: a private redirecting url, next/image can't optimize it
          <img src={`/api/files/${logoKey}`} alt={name} className="size-20 border object-contain" />
        ) : (
          <span className="grid size-20 place-items-center border bg-muted font-heading text-2xl">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <Button disabled={busy} onClick={() => picker.current?.click()}>
          {labels.upload}
        </Button>
        <input
          ref={picker}
          type="file"
          accept={Object.keys(LOGO_TYPES).join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={upload}
        />
        {logoKey && (
          <Button variant="outline" disabled={busy} onClick={remove}>
            {labels.remove}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
