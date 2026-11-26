"use client"

import { Button } from "@ritorno/ui/components/button"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { CONSENT_COOKIE, type Consent, consentCookie } from "./consent"

/** Set on `<html>` while the banner shows. `globals.css` pads the body by it and `bottom-consent` lifts fixed bars above it, so the banner never covers a form button, the phone tabs or the sidebar footer. */
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
    const observer = new ResizeObserver(() => root.style.setProperty(HEIGHT_VAR, `${element.offsetHeight}px`))
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
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground shadow-lg"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 sm:gap-4 sm:py-3">
        <p className="min-w-0 flex-1 text-muted-foreground text-xs sm:text-sm">{labels.text}</p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" className="px-3 sm:px-4" onClick={() => choose("denied")}>
            {labels.decline}
          </Button>
          <Button className="px-3 sm:px-4" onClick={() => choose("granted")}>
            {labels.accept}
          </Button>
        </div>
      </div>
    </section>
  )
}
