import { DEFAULT_LOCALE } from "@ritorno/i18n"
import { buttonVariants } from "@ritorno/ui/components/button"
import { Textarea } from "@ritorno/ui/components/textarea"
import { CheckIcon, CircleAlertIcon, ClockIcon, ExternalLinkIcon, LinkIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { GuestShell, guestLanguage } from "@/components/guest-shell"
import { GuestState } from "@/components/guest-state"
import { SubmitButton } from "@/components/submit-button"
import { getSurveyPage } from "@/lib/api"
import { sendSurvey } from "./actions"

export const metadata: Metadata = {
  title: "Survey",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const NPS = Array.from({ length: 11 }, (_, score) => score)
const STARS = [1, 2, 3, 4, 5]

const PILL =
  "flex min-h-12 items-center justify-center rounded-full border bg-background font-medium tabular-nums transition-colors hover:bg-accent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"

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
  const { error, lang } = await searchParams
  const page = await getSurveyPage(token)

  if (!page) {
    const language = guestLanguage(lang, guestLanguage(await getLocale(), DEFAULT_LOCALE))
    const t = await getTranslations({ locale: language, namespace: "survey" })
    return (
      <GuestShell hotel={null} language={language}>
        <GuestState heading="h1" icon={<LinkIcon />} title={t("invalidTitle")} body={t("invalid")} />
      </GuestShell>
    )
  }

  const language = guestLanguage(lang, page.language)
  const t = await getTranslations({ locale: language, namespace: "survey" })
  const hotel = page.hotel.displayName
  const closed = page.state !== "open"
  const ratings = [
    { key: "rooms", label: t("rooms") },
    { key: "cleanliness", label: t("cleanliness") },
    { key: "service", label: t("service") },
  ]
  const answered = page.state === "answered"
  return (
    <GuestShell hotel={page.hotel} language={language}>
      <div className="grid gap-6 pb-6">
        {closed ? (
          <GuestState
            icon={answered ? <CheckIcon /> : <ClockIcon />}
            title={answered ? t("thanksTitle") : t("expiredTitle")}
            body={answered ? t("thanks", { hotel }) : t("expired", { hotel })}
          >
            {page.reviewToken ? (
              <div className="mt-2 grid w-full gap-3 border-t pt-6">
                <p className="text-muted-foreground">{t("reviewPrompt")}</p>
                <a
                  href={`/r/${page.reviewToken}`}
                  rel="noreferrer"
                  className={buttonVariants({ variant: "secondary", size: "lg", className: "w-full" })}
                >
                  {t("shareOnGoogle")}
                  <ExternalLinkIcon aria-hidden className="rtl:-scale-x-100" />
                </a>
              </div>
            ) : null}
          </GuestState>
        ) : (
          <form action={sendSurvey.bind(null, token, lang ? language : undefined)} className="grid gap-8">
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
            <SubmitButton>{t("send")}</SubmitButton>
          </form>
        )}
      </div>
    </GuestShell>
  )
}
