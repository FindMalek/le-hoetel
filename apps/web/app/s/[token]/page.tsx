import { getDirection } from "@ritorno/i18n"
import { Button, buttonVariants } from "@ritorno/ui/components/button"
import { Textarea } from "@ritorno/ui/components/textarea"
import { CircleAlertIcon, ExternalLinkIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { GuestHero } from "@/components/guest-hero"
import { getSurveyPage } from "@/lib/api"
import { guestBrand } from "@/lib/branding"
import { sendSurvey } from "./actions"

export const metadata: Metadata = {
  title: "Survey",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const NPS = Array.from({ length: 11 }, (_, score) => score)
const STARS = [1, 2, 3, 4, 5]

const PILL =
  "flex min-h-12 items-center justify-center rounded-lg border bg-background font-medium tabular-nums transition-colors hover:bg-accent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring"

function Choice({ name, value, required }: { name: string; value: number; required?: boolean }) {
  return (
    <label className="relative block">
      <input type="radio" name={name} value={value} required={required} className="peer sr-only" />
      <span className={PILL}>{value}</span>
    </label>
  )
}

export default async function Page({ params, searchParams }: PageProps<"/s/[token]">) {
  await connection()
  const { token } = await params
  const { error } = await searchParams
  const page = await getSurveyPage(token)

  if (!page) {
    const t = await getTranslations("survey")
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-2 px-5 py-10">
        <h1 className="font-semibold text-h2 tracking-tight">{t("invalidTitle")}</h1>
        <p className="text-muted-foreground leading-relaxed">{t("invalid")}</p>
      </main>
    )
  }

  const t = await getTranslations({ locale: page.language, namespace: "survey" })
  const hotel = page.hotel.displayName
  const closed = page.state !== "open"
  const ratings = [
    { key: "rooms", label: t("rooms") },
    { key: "cleanliness", label: t("cleanliness") },
    { key: "service", label: t("service") },
  ]
  const answered = page.state === "answered"
  return (
    <div
      lang={page.language}
      dir={getDirection(page.language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={guestBrand(page.hotel)}
      className="min-h-dvh"
    >
      <GuestHero hotel={page.hotel} />
      <main className="mx-auto grid w-full max-w-md gap-6 px-5 py-8">
        {closed ? (
          <div role="status" className="grid gap-2">
            <h2 className="text-balance font-semibold text-h3 tracking-tight">
              {answered ? t("thanksTitle") : t("expiredTitle")}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {answered ? t("thanks", { hotel }) : t("expired", { hotel })}
            </p>
            {page.reviewToken ? (
              <div className="mt-4 grid gap-3 border-t pt-6">
                <p className="text-muted-foreground leading-relaxed">{t("reviewPrompt")}</p>
                <a
                  href={`/r/${page.reviewToken}`}
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "lg", className: "min-h-12 w-full text-base" })}
                >
                  {t("shareOnGoogle")}
                  <ExternalLinkIcon aria-hidden className="rtl:-scale-x-100" />
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <form action={sendSurvey.bind(null, token)} className="grid gap-8">
            <div className="grid gap-2">
              <h2 className="text-balance font-semibold text-h3 tracking-tight">{t("title")}</h2>
              <p className="text-muted-foreground leading-relaxed">{t("intro", { hotel })}</p>
            </div>
            {error ? (
              <p role="alert" className="flex items-center gap-2 text-destructive text-sm">
                <CircleAlertIcon aria-hidden className="size-4 shrink-0" />
                {t("error")}
              </p>
            ) : null}
            <fieldset className="grid gap-3">
              <legend className="mb-3 font-medium leading-snug">{t("nps", { hotel })}</legend>
              <div className="grid grid-cols-6 gap-2">
                {NPS.map((score) => (
                  <Choice key={score} name="nps" value={score} required={score === 0} />
                ))}
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>{t("npsLow")}</span>
                <span>{t("npsHigh")}</span>
              </div>
            </fieldset>
            {ratings.map(({ key, label }) => (
              <fieldset key={key} className="grid gap-3">
                <legend className="mb-3 font-medium leading-snug">
                  {label} <span className="font-normal text-muted-foreground text-sm">{t("optional")}</span>
                </legend>
                <div className="grid grid-cols-5 gap-2">
                  {STARS.map((value) => (
                    <Choice key={value} name={key} value={value} />
                  ))}
                </div>
              </fieldset>
            ))}
            <div className="grid gap-3">
              <label htmlFor="comment" className="font-medium leading-snug">
                {t("comment")} <span className="font-normal text-muted-foreground text-sm">{t("optional")}</span>
              </label>
              <Textarea id="comment" name="comment" maxLength={1000} rows={4} />
            </div>
            <Button type="submit" size="lg" className="min-h-12 w-full text-base">
              {t("send")}
            </Button>
          </form>
        )}
      </main>
    </div>
  )
}
