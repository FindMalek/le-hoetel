import { localizedPath } from "@ritorno/i18n"
import { LocaleSwitcher } from "@ritorno/i18n/switcher"
import { EmbossedWordmark } from "@ritorno/ui/brand/embossed-wordmark"
import { GradientBand } from "@ritorno/ui/brand/gradient-band"
import { Logo } from "@ritorno/ui/brand/logo"
import { cn } from "@ritorno/ui/lib/utils"
import { getLocale, getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"
import { CONTAINER } from "./section"

interface FooterLink {
  href: string
  label: string
  external?: boolean
}

export async function Footer({ docsUrl, whatsappUrl }: { docsUrl: string; whatsappUrl: string | null }) {
  const [t, locale] = await Promise.all([getTranslations("landing.footer"), getLocale()])
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: t("product"),
      links: [
        { href: "#how", label: t("how") },
        { href: "#pricing", label: t("pricing") },
        { href: "#faq", label: t("faq") },
      ],
    },
    {
      title: t("hotels"),
      links: [
        { href: "#features", label: t("recognition") },
        { href: "#features", label: t("consent") },
        { href: "#features", label: t("offers") },
      ],
    },
    {
      title: t("resources"),
      links: [
        { href: docsUrl, label: t("docs") },
        { href: localizedPath(locale, "/status"), label: t("status") },
        { href: "/llms.txt", label: "llms.txt" },
      ],
    },
    {
      title: t("legal"),
      links: [
        { href: localizedPath(locale, "/privacy"), label: t("privacy") },
        { href: localizedPath(locale, "/terms"), label: t("terms") },
      ],
    },
    {
      title: t("contact"),
      links: [
        { href: "#demo", label: t("demo") },
        ...(whatsappUrl ? [{ href: whatsappUrl, label: t("whatsapp"), external: true }] : []),
      ],
    },
  ]
  return (
    <footer className="overflow-hidden border-t bg-canvas">
      <div className={cn(CONTAINER, "pt-16 md:pt-20")}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-medium text-small">{column.title}</h2>
              <span aria-hidden className="mt-2 block h-0.5 w-4 rounded-full bg-blue-500" />
              <ul className="mt-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      className="flex min-h-9 items-center text-muted-foreground text-small transition-colors duration-200 hover:text-foreground coarse:min-h-touch"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo size={24} label={SITE.name} />
            <p className="text-muted-foreground text-small">{t("tagline")}</p>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-muted-foreground text-caption">{t("rights")}</p>
            <LocaleSwitcher mode="path" variant="ghost" />
          </div>
        </div>
      </div>
      <EmbossedWordmark className="mt-10 md:mt-16" />
      <GradientBand className="-mt-10" />
    </footer>
  )
}
