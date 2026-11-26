import { LocaleSwitcher } from "@ritorno/i18n/switcher"
import { Logo } from "@ritorno/ui/brand/logo"
import { buttonVariants } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"
import { ThemeToggle } from "../theme-toggle"
import { CONTAINER } from "./section"

export async function Header() {
  const t = await getTranslations("landing.nav")
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-sm">
      <div className={`${CONTAINER} flex h-14 items-center justify-between gap-4`}>
        <a href="#top" className="flex min-h-11 items-center">
          <Logo size={28} label={SITE.name} />
        </a>
        <nav aria-label={t("menu")} className="hidden items-center gap-6 text-muted-foreground text-sm md:flex">
          <a href="#how" className="transition-colors duration-150 hover:text-foreground">
            {t("how")}
          </a>
          <a href="#pricing" className="transition-colors duration-150 hover:text-foreground">
            {t("pricing")}
          </a>
          <a href="#faq" className="transition-colors duration-150 hover:text-foreground">
            {t("faq")}
          </a>
        </nav>
        <div className="flex items-center gap-1">
          <LocaleSwitcher mode="path" />
          <ThemeToggle />
          <a href="#demo" className={cn(buttonVariants(), "ms-2 hidden min-h-9 sm:inline-flex")}>
            {t("demo")}
          </a>
        </div>
      </div>
    </header>
  )
}
