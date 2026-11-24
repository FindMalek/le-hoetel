import { localizedPath } from "@le-hoetel/i18n"
import { getLocale, getTranslations } from "next-intl/server"
import { Zellige } from "@/components/zellige"

export default async function NotFound() {
  const [t, locale] = await Promise.all([getTranslations("notFound"), getLocale()])
  return (
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-3 overflow-hidden px-5 text-center">
      <Zellige className="-z-10 text-foreground/10" />
      <h1 className="font-semibold text-h1 tracking-tight">{t("title")}</h1>
      <p className="max-w-[40ch] text-muted-foreground">{t("body")}</p>
      <a
        href={localizedPath(locale, "/")}
        className="mt-3 inline-flex h-11 items-center rounded-xl bg-primary px-5 font-medium text-primary-foreground text-sm"
      >
        {t("home")}
      </a>
    </main>
  )
}
