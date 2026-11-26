import { Logo } from "@ritorno/ui/brand/logo"
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { SITE } from "@/lib/site"

export const baseOptions: BaseLayoutProps = {
  nav: { title: <Logo size={24} label={SITE.name} /> },
  githubUrl: SITE.github || undefined,
  themeSwitch: { enabled: false },
}
