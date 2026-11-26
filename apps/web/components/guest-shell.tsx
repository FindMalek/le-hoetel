import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { getDirection, localizedPath } from "@ritorno/i18n"
import { cn } from "@ritorno/ui/lib/utils"
import { getTranslations } from "next-intl/server"
import { guestBrand } from "@/lib/branding"
import { SITE } from "@/lib/site"

export type GuestHotel = {
  displayName: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
}

const LANGUAGE_NAMES: Record<HotelLanguage, string> = { en: "English", fr: "Français", ar: "العربية" }

/** `?lang=` lets a guest read the page in another language than the one the hotel or the message picked. */
export const guestLanguage = (requested: string | string[] | undefined, fallback: HotelLanguage): HotelLanguage =>
  HOTEL_LANGUAGES.find((language) => language === requested) ?? fallback

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toUpperCase()

function HotelMark({ hotel }: { hotel: GuestHotel }) {
  return (
    <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border bg-background shadow-xs">
      {hotel.logoUrl ? (
        // biome-ignore lint/performance/noImgElement: the logo is a hotel upload served by the api, not a static asset
        <img
          src={hotel.logoUrl}
          alt=""
          width={64}
          height={64}
          decoding="async"
          fetchPriority="high"
          className="size-full object-contain p-2"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-full items-center justify-center bg-primary font-semibold text-primary-foreground text-xl"
        >
          {initials(hotel.displayName)}
        </span>
      )}
    </div>
  )
}

/**
 * The frame of every guest page (`/h`, `/s`, `/u`, `/o`, `/r`): the hotel's logo, name and colors on top, Ritorno only
 * as a small line in the footer. A phone column on a phone, a card on the surface from `md`.
 */
export async function GuestShell({
  hotel,
  language,
  line,
  languageHref = (to) => `?lang=${to}`,
  children,
}: {
  hotel: GuestHotel | null
  language: HotelLanguage
  line?: string
  languageHref?: ((to: HotelLanguage) => string) | null
  children: React.ReactNode
}) {
  const t = await getTranslations({ locale: language, namespace: "guest" })
  return (
    <div
      lang={language}
      dir={getDirection(language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={hotel ? guestBrand(hotel) : undefined}
      className="flex min-h-dvh flex-col bg-background md:bg-surface md:px-6 md:py-12"
    >
      <div className="mx-auto flex w-full flex-1 flex-col md:max-w-lg md:flex-none md:overflow-hidden md:rounded-panel md:border md:bg-background">
        <header className={cn("relative px-5 pt-4", hotel ? "border-b bg-primary/6 pb-7" : "pb-2")}>
          {hotel ? <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-primary" /> : null}
          {languageHref ? (
            <nav aria-label={t("languageLabel")} className="flex justify-end">
              <div className="flex rounded-full border bg-background p-0.5 text-sm">
                {HOTEL_LANGUAGES.map((to) => (
                  <a
                    key={to}
                    href={languageHref(to)}
                    lang={to}
                    hrefLang={to}
                    aria-current={to === language ? "true" : undefined}
                    className="flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-muted-foreground transition-colors duration-150 hover:text-foreground aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"
                  >
                    {LANGUAGE_NAMES[to]}
                  </a>
                ))}
              </div>
            </nav>
          ) : null}
          {hotel ? (
            <div className="mt-4 flex flex-col items-center gap-3 text-center">
              <HotelMark hotel={hotel} />
              <h1 className="text-balance font-semibold text-h2 tracking-tight">{hotel.displayName}</h1>
              {line ? <p className="max-w-xs text-balance text-muted-foreground">{line}</p> : null}
            </div>
          ) : null}
        </header>
        <main className="flex w-full flex-1 flex-col px-5 pt-6 pb-2">{children}</main>
        <footer className="flex flex-wrap items-center justify-center gap-x-6 px-5 py-4 text-caption text-muted-foreground">
          <a href={localizedPath(language, "/privacy")} className="flex min-h-11 items-center underline">
            {t("privacy")}
          </a>
          <a href={localizedPath(language, "/terms")} className="flex min-h-11 items-center underline">
            {t("terms")}
          </a>
          <span className="flex min-h-11 items-center">{t("poweredBy", { brand: SITE.name })}</span>
        </footer>
      </div>
    </div>
  )
}
