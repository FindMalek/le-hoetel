import "@le-hoetel/ui/globals.css"
import { ConsentBanner } from "@le-hoetel/compliance/banner"
import { DEFAULT_LOCALE, htmlAttributes, isLocale } from "@le-hoetel/i18n"
import { QueryProvider } from "@le-hoetel/orpc/react"
import { Toaster } from "@le-hoetel/ui/components/sonner"
import { TooltipProvider } from "@le-hoetel/ui/components/tooltip"
import { cn } from "@le-hoetel/ui/lib/utils"
import type { Metadata } from "next"
import { getLocale } from "next-intl/server"
import { FeedbackButton } from "@/components/feedback-button"
import { ThemeProvider } from "@/components/theme-provider"
import { Umami } from "@/components/umami"
import { dashboardUrl, SITE } from "@/lib/site"
import { fontVariables } from "./fonts"

// Prerendered pages would bake the build-time DASHBOARD_URL into `metadataBase`.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  metadataBase: new URL(dashboardUrl()),
  title: { default: "Dashboard", template: "%s · le-hoetel" },
  description: SITE.tagline,
  openGraph: { title: `${SITE.name} dashboard`, description: SITE.tagline, siteName: SITE.name },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale()
  const { lang, dir } = htmlAttributes(isLocale(locale) ? locale : DEFAULT_LOCALE)
  return (
    <html lang={lang} dir={dir} suppressHydrationWarning className={cn("antialiased", fontVariables, "font-sans")}>
      <body className="bg-background text-foreground">
        <ThemeProvider>
          <Umami />
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <FeedbackButton />
          </QueryProvider>
          <Toaster position="top-center" />
          <ConsentBanner />
        </ThemeProvider>
      </body>
    </html>
  )
}
