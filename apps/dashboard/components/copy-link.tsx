"use client"

import { Button } from "@ritorno/ui/components/button"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function CopyLink({ url, label, done }: { url: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success(done)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" onClick={copy}>
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {label}
    </Button>
  )
}
