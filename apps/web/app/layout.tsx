import "@le-hoetel/ui/globals.css"
import { ConsentBanner } from "@le-hoetel/compliance/banner"
import { alternateUrls, DEFAULT_LOCALE, htmlAttributes, isLocale, LOCALE_META, PATHNAME_HEADER } from "@le-hoetel/i18n"
import { QueryProvider } from "@le-hoetel/orpc/react"
import { cn } from "@le-hoetel/ui/lib/utils"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { getLocale } from "next-intl/server"
import { FeedbackButton } from "@/components/feedback-button"
import { ThemeProvider } from "@/components/theme-provider"
import { Umami } from "@/components/umami"
import { siteUrl } from "@/lib/seo"
import { SITE } from "@/lib/site"
import { fontVariables } from "./fonts"

/** The guest QR page ships none of the site chrome (feedback, consent banner, analytics): it must load fast on a weak connection. */
const CAPTURE_PATH = "/h/"

export async function generateMetadata(): Promise<Metadata> {
  const [locale, pathname] = await Promise.all([getLocale(), headers().then((h) => h.get(PATHNAME_HEADER) ?? "/")])
  const languages = alternateUrls(siteUrl(), pathname)
  const current = isLocale(locale) ? locale : DEFAULT_LOCALE
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: SITE.name, template: `%s | ${SITE.name}` },
    description: SITE.tagline,
    alternates: { canonical: languages[LOCALE_META[current].hreflang], languages },
    openGraph: {
      title: SITE.name,
      description: SITE.tagline,
      type: "website",
      siteName: SITE.name,
      url: languages[LOCALE_META[current].hreflang],
      locale: LOCALE_META[current].ogLocale,
    },
    twitter: { card: "summary_large_image" },
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, pathname] = await Promise.all([getLocale(), headers().then((h) => h.get(PATHNAME_HEADER) ?? "/")])
  const { lang, dir } = htmlAttributes(isLocale(locale) ? locale : DEFAULT_LOCALE)
  return (
    <html
      lang={lang}
      dir={dir}
      suppressHydrationWarning
      className={cn("h-full antialiased", fontVariables, "font-sans")}
    >
      <body className="relative flex min-h-full flex-col bg-background text-foreground">
        {pathname.startsWith(CAPTURE_PATH) ? (
          children
        ) : (
          <ThemeProvider>
            <Umami />
            <QueryProvider>
              <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute inset-x-0 top-0 h-128 bg-glow" />
                <div className="absolute inset-0 bg-dots" />
              </div>
              {children}
              <FeedbackButton />
            </QueryProvider>
            <ConsentBanner />
          </ThemeProvider>
        )}
      </body>
    </html>
  )
}
