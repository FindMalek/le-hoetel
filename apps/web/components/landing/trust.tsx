import { localizedPath } from "@le-hoetel/i18n"
import { ArrowRightIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { CONTAINER } from "./section"

export async function Trust() {
  const [t, locale] = await Promise.all([getTranslations("landing.trust"), getLocale()])
  const points = [
    { title: t("consent.title"), body: t("consent.body") },
    { title: t("stop.title"), body: t("stop.body") },
    { title: t("control.title"), body: t("control.body") },
    { title: t("apart.title"), body: t("apart.body") },
    { title: t("minimum.title"), body: t("minimum.body") },
  ]
  return (
    <section className="border-t bg-muted/40">
      <div className={`${CONTAINER} grid gap-10 py-16 md:grid-cols-5 md:gap-16 md:py-24`}>
        <div className="grid content-start gap-4 md:col-span-2">
          <h2 className="text-balance font-semibold text-h2 tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground leading-relaxed">{t("subtitle")}</p>
          <a
            href={localizedPath(locale, "/privacy")}
            className="inline-flex min-h-11 w-fit items-center gap-2 font-medium text-sm underline-offset-4 hover:underline"
          >
            {t("privacy")}
            <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
          </a>
        </div>
        <ul className="divide-y border-y md:col-span-3">
          {points.map((point) => (
            <li key={point.title} className="grid gap-1 py-5">
              <h3 className="font-semibold">{point.title}</h3>
              <p className="max-w-[65ch] text-muted-foreground text-sm leading-relaxed">{point.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
