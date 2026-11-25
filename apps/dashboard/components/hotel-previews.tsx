"use client"

import { brandStyle } from "@le-hoetel/common/color"
import type { HotelLanguage } from "@le-hoetel/common/hotel"
import { ZelligePattern } from "@le-hoetel/ui/components/zellige-pattern"
import { cn } from "@le-hoetel/ui/lib/utils"
import { useTranslations } from "next-intl"
import { isHex } from "@/components/admin-fields"

interface Look {
  name: string
  logo?: string | null
  primaryColor: string
  accentColor: string
  language: HotelLanguage
}

const colors = (look: Look) => ({
  primaryColor: isHex(look.primaryColor) ? look.primaryColor : null,
  accentColor: isHex(look.accentColor) ? look.accentColor : null,
})

function Mark({ name, logo }: { name: string; logo?: string | null }) {
  return logo ? (
    // biome-ignore lint/performance/noImgElement: the logo is a small file served by the api
    <img src={logo} alt="" className="size-12 rounded-lg bg-background object-contain p-1" />
  ) : (
    <span className="grid size-12 place-items-center rounded-lg bg-primary-foreground/15 font-heading font-semibold text-xl">
      {name.trim().slice(0, 1).toUpperCase() || "·"}
    </span>
  )
}

/** What a guest sees after scanning: the hotel's own name, logo and colors over the shared form. Text is in the hotel's language. */
export function CapturePreview({ look, className }: { look: Look; className?: string }) {
  const t = useTranslations("adminHotel")
  const name = look.name.trim() || t("previewName")
  const rtl = look.language === "ar"
  return (
    <figure className={cn("mx-auto w-full max-w-72", className)}>
      <div
        dir={rtl ? "rtl" : "ltr"}
        lang={look.language}
        // the hotel's colors are css variables built by brandStyle
        // oxlint-disable-next-line shadcn/no-inline-styles
        style={brandStyle(colors(look))}
        className="overflow-hidden rounded-3xl border bg-background text-foreground shadow-sm"
      >
        <div className="relative isolate flex flex-col gap-3 bg-primary px-5 pt-7 pb-6 text-primary-foreground">
          <div aria-hidden className="-z-10 absolute inset-0">
            <ZelligePattern />
          </div>
          <Mark name={name} logo={look.logo} />
          <p className="font-heading font-semibold text-xl leading-tight">{t(`preview.${look.language}.welcome`, { hotel: name })}</p>
          <p className="text-primary-foreground/85 text-sm leading-relaxed">{t(`preview.${look.language}.intro`)}</p>
        </div>
        <div className="flex flex-col gap-3 p-5" aria-hidden>
          {(["name", "phone"] as const).map((field) => (
            <div key={field} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">{t(`preview.${look.language}.${field}`)}</span>
              <span className="h-10 rounded-lg border bg-muted/40" />
            </div>
          ))}
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span className="size-4 shrink-0 rounded-sm border border-brand-accent bg-brand-accent/20" />
            {t(`preview.${look.language}.consent`)}
          </div>
          <span className="grid h-11 place-items-center rounded-lg bg-primary font-medium text-primary-foreground text-sm">
            {t(`preview.${look.language}.submit`)}
          </span>
        </div>
      </div>
    </figure>
  )
}

/** The mail the owner gets, in the hotel's language, with the hotel's colors on the button. */
export function InvitePreview({ look, email, className }: { look: Look; email: string; className?: string }) {
  const t = useTranslations("adminHotel")
  const name = look.name.trim() || t("previewName")
  const rtl = look.language === "ar"
  return (
    <figure className={cn("mx-auto w-full max-w-sm", className)}>
      <div
        dir={rtl ? "rtl" : "ltr"}
        lang={look.language}
        // the hotel's colors are css variables built by brandStyle
        // oxlint-disable-next-line shadcn/no-inline-styles
        style={brandStyle(colors(look))}
        className="overflow-hidden rounded-xl border bg-background text-foreground shadow-sm"
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b bg-muted/40 px-4 py-3 text-xs">
          <dt className="text-muted-foreground">{t("mailTo")}</dt>
          <dd className="truncate" dir="ltr">
            {email || t("mailToEmpty")}
          </dd>
          <dt className="text-muted-foreground">{t("mailSubject")}</dt>
          <dd className="font-medium">{t(`invite.${look.language}.subject`, { hotel: name })}</dd>
        </dl>
        <div className="flex flex-col gap-3 p-5 text-sm leading-relaxed">
          <p className="font-heading font-semibold text-base">{t(`invite.${look.language}.title`, { hotel: name })}</p>
          <p>{t(`invite.${look.language}.body`, { hotel: name })}</p>
          <span className="grid h-11 place-items-center rounded-lg bg-primary font-medium text-primary-foreground">
            {t(`invite.${look.language}.button`)}
          </span>
          <p className="text-muted-foreground text-xs">{t(`invite.${look.language}.footer`)}</p>
        </div>
      </div>
    </figure>
  )
}
