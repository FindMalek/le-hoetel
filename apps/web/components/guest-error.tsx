"use client"

import type { HotelLanguage } from "@ritorno/common/hotel"
import { getDirection } from "@ritorno/i18n/config"
import { Button } from "@ritorno/ui/components/button"
import { CircleAlertIcon } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { createContext, useContext } from "react"
import { GuestState } from "./guest-state"

export type GuestErrorCopy = Record<HotelLanguage, { title: string; body: string; retry: string }>

const GuestErrorContext = createContext<{ copy: GuestErrorCopy; fallback: HotelLanguage } | null>(null)

export function GuestErrorProvider({
  copy,
  fallback,
  children,
}: {
  copy: GuestErrorCopy
  fallback: HotelLanguage
  children: React.ReactNode
}) {
  return <GuestErrorContext value={{ copy, fallback }}>{children}</GuestErrorContext>
}

/** The error boundary of every guest page. It keeps the guest's `?lang=` when the page had one. */
export function GuestError({ reset }: { error: Error; reset: () => void }) {
  const context = useContext(GuestErrorContext)
  const requested = useSearchParams().get("lang")
  if (!context) return null
  const language = (Object.keys(context.copy) as HotelLanguage[]).find((l) => l === requested) ?? context.fallback
  const copy = context.copy[language]
  return (
    <div
      lang={language}
      dir={getDirection(language)}
      className="flex min-h-dvh flex-col bg-background px-5 md:bg-surface md:px-6 md:py-12"
    >
      <div className="mx-auto flex w-full flex-1 flex-col md:max-w-lg md:flex-none md:rounded-panel md:border md:bg-background md:px-5">
        <GuestState heading="h1" tone="danger" icon={<CircleAlertIcon />} title={copy.title} body={copy.body}>
          <Button size="lg" onClick={reset} className="w-full max-w-xs">
            {copy.retry}
          </Button>
        </GuestState>
      </div>
    </div>
  )
}
