import { LocaleSwitcher } from "@le-hoetel/i18n/switcher"
import { ZelligePattern } from "@le-hoetel/ui/components/zellige-pattern"
import { getTranslations } from "next-intl/server"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth")
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-primary p-12 text-primary-foreground lg:flex">
        <ZelligePattern className="-z-10 absolute inset-0 text-primary-foreground opacity-[0.09]" />
        <BrandMark />
        <div className="flex max-w-md flex-col gap-4">
          <p className="text-balance font-heading font-semibold text-4xl tracking-tight">{t("brandTitle")}</p>
          <p className="text-pretty text-lg text-primary-foreground/80">{t("brandBody")}</p>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col px-4 pt-safe pb-safe">
        <header className="flex items-center justify-between py-3">
          <BrandMark className="lg:invisible" />
          <div className="flex items-center gap-1">
            <LocaleSwitcher mode="cookie" />
            <ThemeToggle />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">{children}</main>
      </div>
    </div>
  )
}
