"use client"

import { Button } from "@ritorno/ui/components/button"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { CONSENT_COOKIE, type Consent, consentCookie } from "./consent"

/** Room the card takes above the bottom edge, set on `<html>` while it shows. The body, sidebar footer, sticky form actions and feedback button keep clear of it, so the card never covers them. */
const HEIGHT_VAR = "--consent-banner-height"

export type ConsentBannerLabels = { label: string; text: string; decline: string; accept: string }

/**
 * Asks once before analytics run. The choice is the `consent` cookie, which the analytics components read on the
 * server, so a refresh after the click is what starts (or keeps off) the scripts.
 */
export function ConsentBanner({ labels }: { labels: ConsentBannerLabels }) {
  const router = useRouter()
  const ref = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setOpen(!document.cookie.split("; ").some((part) => part.startsWith(`${CONSENT_COOKIE}=`)))
  }, [])
  useEffect(() => {
    const element = ref.current
    if (!open || !element) return
    const root = document.documentElement
    const observer = new ResizeObserver(() =>
      root.style.setProperty(HEIGHT_VAR, `calc(${element.offsetHeight}px + 0.75rem)`),
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
      root.style.removeProperty(HEIGHT_VAR)
    }
  }, [open])
  if (!open) return null

  const choose = (value: Consent) => {
    // biome-ignore lint/suspicious/noDocumentCookie: a plain cookie the server reads, the Cookie Store API is not everywhere yet
    document.cookie = consentCookie(value)
    setOpen(false)
    router.refresh()
  }
  return (
    <section
      ref={ref}
      aria-label={labels.label}
      data-consent-banner=""
      className="fixed inset-x-3 bottom-3 z-50 mx-auto mb-(--consent-banner-offset,env(safe-area-inset-bottom)) flex max-w-xl flex-col gap-2 rounded-2xl border bg-card p-3 text-card-foreground shadow-md sm:flex-row sm:items-center sm:gap-4 sm:p-4"
    >
      <p className="min-w-0 flex-1 text-caption text-muted-foreground sm:text-sm">{labels.text}</p>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => choose("denied")}>
          {labels.decline}
        </Button>
        <Button onClick={() => choose("granted")}>{labels.accept}</Button>
      </div>
    </section>
  )
}
