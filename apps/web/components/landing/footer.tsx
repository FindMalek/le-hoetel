import { localizedPath } from "@ritorno/i18n"
import { LocaleSwitcher } from "@ritorno/i18n/switcher"
import { Logo } from "@ritorno/ui/brand/logo"
import { getLocale, getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"
import { CONTAINER } from "./section"

export async function Footer() {
  const [t, locale] = await Promise.all([getTranslations("landing.footer"), getLocale()])
  const links = [
    { href: localizedPath(locale, "/privacy"), label: t("privacy") },
    { href: localizedPath(locale, "/terms"), label: t("terms") },
    { href: localizedPath(locale, "/status"), label: t("status") },
  ]
  return (
    <footer className="border-t bg-background">
      <div className={`${CONTAINER} flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between`}>
        <div className="grid gap-1">
          <Logo size={28} label={SITE.name} />
          <p className="text-muted-foreground text-sm">{t("tagline")}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 text-muted-foreground text-sm">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="flex min-h-11 items-center hover:text-foreground">
              {link.label}
            </a>
          ))}
          <LocaleSwitcher mode="path" />
        </nav>
      </div>
      <p className={`${CONTAINER} pb-8 text-muted-foreground text-xs`}>{t("rights")}</p>
    </footer>
  )
}
