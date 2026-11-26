import { LocaleSwitcher } from "@ritorno/i18n/switcher"
import { PillNav } from "@ritorno/ui/brand/pill-nav"
import { getTranslations } from "next-intl/server"
import { SITE } from "@/lib/site"

export async function Header({ docsUrl }: { docsUrl: string }) {
  const t = await getTranslations("landing.nav")
  return (
    <PillNav
      homeHref="#top"
      homeLabel={SITE.name}
      navLabel={t("label")}
      menuLabel={t("menu")}
      links={[
        { href: "#how", label: t("how") },
        { href: "#pricing", label: t("pricing") },
        { href: "#faq", label: t("faq") },
        { href: docsUrl, label: t("docs") },
      ]}
      cta={{ href: "#demo", label: t("demo") }}
      language={<LocaleSwitcher mode="path" variant="ghost" />}
    />
  )
}
