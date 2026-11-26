import "@ritorno/ui/globals.css"
import { ConsentBanner } from "@ritorno/compliance/banner"
import { DEFAULT_LOCALE, htmlAttributes, isLocale } from "@ritorno/i18n"
import { QueryProvider } from "@ritorno/orpc/react"
import { Toaster } from "@ritorno/ui/components/sonner"
import { TooltipProvider } from "@ritorno/ui/components/tooltip"
import { cn } from "@ritorno/ui/lib/utils"
import type { Metadata } from "next"
import { NextIntlClientProvider } from "next-intl"
import { getLocale, getTranslations } from "next-intl/server"
import { dashboardUrl, SITE } from "@/lib/site"
import { fontVariables } from "./fonts"

// Prerendered pages would bake the build-time DASHBOARD_URL into `metadataBase`.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  metadataBase: new URL(dashboardUrl()),
  title: { default: "Dashboard", template: "%s · Ritorno" },
  description: SITE.tagline,
  openGraph: { title: `${SITE.name} dashboard`, description: SITE.tagline, siteName: SITE.name },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("consentBanner")])
  const { lang, dir } = htmlAttributes(isLocale(locale) ? locale : DEFAULT_LOCALE)
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning className={cn("antialiased", fontVariables, "font-sans")}>
      <body className="bg-background text-foreground">
        <QueryProvider>
          <NextIntlClientProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </NextIntlClientProvider>
        </QueryProvider>
        <Toaster position="top-center" />
        <ConsentBanner
          labels={{
            label: t("label"),
            text: t("text"),
            decline: t("decline"),
            accept: t("accept"),
          }}
        />
      </body>
    </html>
  )
}
