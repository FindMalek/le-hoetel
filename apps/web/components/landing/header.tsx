import { localizedPath } from "@ritorno/i18n"
import { PillNav } from "@ritorno/ui/brand/pill-nav"
import { getLocale, getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"

/** `home` prefixes the section anchors on pages other than the landing, so `#how` still lands there. */
export async function Header({
  docsUrl,
  dashboardUrl,
  home = "",
}: {
  docsUrl: string
  dashboardUrl: string
  home?: string
}) {
  const [t, locale] = await Promise.all([getTranslations("landing.nav"), getLocale()])
  return (
    <PillNav
      homeHref={home || "#top"}
      homeLabel={SITE.name}
      navLabel={t("label")}
      menuLabel={t("menu")}
      links={[
        { href: `${home}#how`, label: t("how") },
        { href: `${home}#pricing`, label: t("pricing") },
        { href: `${home}#faq`, label: t("faq") },
        { href: localizedPath(locale, "/roadmap"), label: t("roadmap") },
        { href: docsUrl, label: t("docs") },
      ]}
      cta={{ href: `${home}#demo`, label: t("demo") }}
      signIn={{ href: dashboardUrl, label: t("signIn") }}
    />
  )
}
