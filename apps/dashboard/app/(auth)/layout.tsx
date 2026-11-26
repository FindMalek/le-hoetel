import { LocaleSwitcher } from "@ritorno/i18n/switcher"
import { Display } from "@ritorno/ui/brand/display"
import { Logo } from "@ritorno/ui/brand/logo"
import { PixelSky } from "@ritorno/ui/brand/pixel-sky"
import { getTranslations } from "next-intl/server"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth")
  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      <aside className="relative isolate h-24 shrink-0 overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:p-10">
        <PixelSky className="-z-10 lg:hidden" />
        <PixelSky clearCenter className="-z-10 max-lg:hidden" />
        <span className="hidden h-12 items-center self-start rounded-full bg-background px-4 text-foreground shadow-md lg:inline-flex">
          <Logo size={28} />
        </span>
        <div data-sky-clear className="m-auto hidden max-w-md flex-col gap-5 text-center lg:flex">
          <Display as="p" className="text-navy">
            {t("brandTitle")}
          </Display>
          <p className="text-pretty text-lead text-navy/80">{t("brandBody")}</p>
        </div>
      </aside>
      <div className="flex flex-1 flex-col bg-background px-4 pb-safe md:px-6 lg:min-h-dvh lg:pt-safe">
        <header className="flex items-center justify-between gap-2 py-3">
          <Logo size={28} className="lg:invisible" />
          <LocaleSwitcher mode="cookie" />
        </header>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col py-8 lg:justify-center lg:py-12">{children}</main>
      </div>
    </div>
  )
}
