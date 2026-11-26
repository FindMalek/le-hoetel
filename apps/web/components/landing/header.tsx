import { LocaleSwitcher } from "@ritorno/i18n/switcher"
import { buttonVariants } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"
import { CONTAINER } from "./section"

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="5" width="14" height="14" />
      <rect x="5" y="5" width="14" height="14" transform="rotate(45 12 12)" />
    </svg>
  )
}

export async function Header() {
  const t = await getTranslations("landing.nav")
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-sm">
      <div className={`${CONTAINER} flex h-14 items-center justify-between gap-4`}>
        <a href="#top" className="flex items-center gap-2 font-semibold tracking-tight">
          <Mark className="size-5 text-primary" />
          {SITE.name}
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
          <a href="#demo" className={cn(buttonVariants(), "ms-2 hidden min-h-9 sm:inline-flex")}>
            {t("demo")}
          </a>
        </div>
      </div>
    </header>
  )
}
