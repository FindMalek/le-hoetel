"use client"

import { brandStyle } from "@le-hoetel/common/color"
import type { HotelLanguage } from "@le-hoetel/common/hotel"
import { Tabs, TabsList, TabsTrigger } from "@le-hoetel/ui/components/tabs"
import { cn } from "@le-hoetel/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useState } from "react"

/** The few guest facing strings the preview needs, in each of the hotel's languages (`{hotel}` and `{name}` are filled here). */
export interface PreviewCopy {
  welcome: string
  intro: string
  name: string
  phone: string
  submit: string
  sample: string
  emailTitle: string
  emailBody: string
  emailCta: string
  emailFooter: string
  unsubscribe: string
}
export type PreviewCopies = Record<HotelLanguage, PreviewCopy>

export interface BrandDraft {
  name: string
  logoSrc: string | null
  primaryColor: string | null
  accentColor: string | null
  address: string | null
  language: HotelLanguage
}

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")

function HotelMark({ name, logoSrc, size }: { name: string; logoSrc: string | null; size: "sm" | "md" }) {
  if (logoSrc) {
    // biome-ignore lint/performance/noImgElement: a hotel upload behind the dashboard's file proxy
    return <img src={logoSrc} alt="" className={cn("w-auto object-contain", size === "md" ? "h-12" : "h-8")} />
  }
  return <span className="font-heading font-semibold text-lg tracking-tight">{name}</span>
}

function CapturePreview({ draft, copy }: { draft: BrandDraft; copy: PreviewCopy }) {
  const values = { hotel: draft.name }
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border bg-background shadow-sm">
      <div className="h-1.5 bg-brand-accent" />
      <div className="flex flex-col gap-5 p-5">
        <HotelMark name={draft.name} logoSrc={draft.logoSrc} size="md" />
        <div className="flex flex-col gap-1.5">
          <p className="text-balance font-heading font-semibold text-xl leading-tight tracking-tight">
            {fill(copy.welcome, values)}
          </p>
          <p className="text-pretty text-muted-foreground text-sm">{copy.intro}</p>
        </div>
        <div className="flex flex-col gap-3">
          {[copy.name, copy.phone].map((label) => (
            <div key={label} className="flex flex-col gap-1.5">
              <span className="font-medium text-xs">{label}</span>
              <span className="h-10 rounded-lg border bg-muted/40" />
            </div>
          ))}
        </div>
        <span className="grid h-11 place-items-center rounded-lg bg-primary font-medium text-primary-foreground text-sm">
          {copy.submit}
        </span>
      </div>
    </div>
  )
}

function EmailPreview({ draft, copy }: { draft: BrandDraft; copy: PreviewCopy }) {
  const values = { hotel: draft.name, name: copy.sample }
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="h-1.5 bg-brand-accent" />
      <div className="flex flex-col gap-4 px-5 pt-5 pb-4">
        <HotelMark name={draft.name} logoSrc={draft.logoSrc} size="md" />
        <p className="font-heading font-semibold text-lg tracking-tight">{fill(copy.emailTitle, values)}</p>
        <p className="text-pretty text-muted-foreground text-sm">{fill(copy.emailBody, values)}</p>
        <span className="self-start rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm">
          {copy.emailCta}
        </span>
      </div>
      <div className="flex flex-col gap-1 border-t px-5 py-4 text-muted-foreground text-xs">
        <p>{fill(copy.emailFooter, values)}</p>
        <p>{draft.address ? `${draft.name} · ${draft.address}` : draft.name}</p>
        <p className="underline">{copy.unsubscribe}</p>
      </div>
    </div>
  )
}

/** What a guest sees of the hotel's branding: the sign-up page behind the QR code and the header and footer of its emails. Updates with every keystroke. */
export function BrandPreview({
  draft,
  copies,
  className,
}: {
  draft: BrandDraft
  copies: PreviewCopies
  className?: string
}) {
  const t = useTranslations("hotelSettings.preview")
  const [view, setView] = useState<"capture" | "email">("capture")
  const copy = copies[draft.language]
  return (
    <section aria-labelledby="brand-preview-title" className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="brand-preview-title" className="font-heading font-semibold text-base">
          {t("title")}
        </h2>
        <Tabs value={view} onValueChange={(next) => setView(next as typeof view)}>
          <TabsList>
            <TabsTrigger value="capture">{t("capture")}</TabsTrigger>
            <TabsTrigger value="email">{t("email")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div
        lang={draft.language}
        dir={draft.language === "ar" ? "rtl" : "ltr"}
        // the preview wears the draft colors the same way the guest pages do
        // oxlint-disable-next-line shadcn/no-inline-styles
        style={brandStyle(draft)}
        className="mx-auto w-full max-w-xs rounded-2xl bg-muted/50 p-4 data-[view=email]:max-w-md"
        data-view={view}
      >
        <div aria-hidden>
          {view === "capture" ? (
            <CapturePreview draft={draft} copy={copy} />
          ) : (
            <EmailPreview draft={draft} copy={copy} />
          )}
        </div>
      </div>
      <p className="text-pretty text-muted-foreground text-sm">{t("hint")}</p>
    </section>
  )
}
