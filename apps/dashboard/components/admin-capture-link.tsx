"use client"

import { Button } from "@le-hoetel/ui/components/button"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

export function AdminCaptureLink({ url }: { url: string }) {
  const t = useTranslations("adminHotel")
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success(t("linkCopied"))
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-lg border bg-muted/40 px-3 py-2.5 text-sm" dir="ltr">
        {url}
      </code>
      <Button variant="outline" onClick={copy}>
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {t("copyLink")}
      </Button>
    </div>
  )
}
