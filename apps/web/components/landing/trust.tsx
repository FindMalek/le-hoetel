import { localizedPath } from "@ritorno/i18n"
import { ArrowRightIcon, Building2Icon, ClipboardCheckIcon, FileDownIcon, ShieldOffIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { CONTAINER } from "./section"

export async function Trust() {
  const [t, locale] = await Promise.all([getTranslations("landing.trust"), getLocale()])
  const points = [
    { icon: ClipboardCheckIcon, title: t("consent.title"), body: t("consent.body") },
    { icon: FileDownIcon, title: t("control.title"), body: t("control.body") },
    { icon: Building2Icon, title: t("apart.title"), body: t("apart.body") },
    { icon: ShieldOffIcon, title: t("minimum.title"), body: t("minimum.body") },
  ]
  return (
    <section aria-labelledby="trust-title" className="bg-canvas pb-20 md:pb-28 lg:pb-32">
      <div className={CONTAINER}>
        <div className="relative isolate overflow-hidden rounded-panel bg-ink-900 px-6 py-10 text-background md:px-10 md:py-14 lg:px-12">
          <div aria-hidden className="absolute -end-40 -top-40 -z-10 size-144 rounded-full bg-rings opacity-60" />
          <div className="grid max-w-xl gap-3">
            <h2 id="trust-title" className="text-balance font-medium text-h1">
              {t("title")}
            </h2>
            <p className="text-pretty text-background/70">{t("subtitle")}</p>
          </div>
          <ul className="mt-12 grid gap-8 sm:grid-cols-2 md:mt-16 lg:grid-cols-4 lg:gap-6">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="grid content-start gap-1.5">
                <span className="mb-3 grid size-10 place-items-center rounded-xl bg-background/10 ring-1 ring-background/10">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="font-medium text-body">{title}</h3>
                <p className="text-background/65 text-small">{body}</p>
              </li>
            ))}
          </ul>
          <a
            href={localizedPath(locale, "/privacy")}
            className="group/link mt-10 inline-flex min-h-11 items-center gap-1.5 font-medium text-background text-small underline-offset-4 hover:underline"
          >
            {t("privacy")}
            <ArrowRightIcon aria-hidden className="size-4 rtl:rotate-180" />
          </a>
        </div>
      </div>
    </section>
  )
}
