import "@ritorno/ui/globals.css"
import { ConsentBanner } from "@ritorno/compliance/banner"
import { alternateUrls, DEFAULT_LOCALE, htmlAttributes, isLocale, LOCALE_META, PATHNAME_HEADER } from "@ritorno/i18n"
import { QueryProvider } from "@ritorno/orpc/react"
import { cn } from "@ritorno/ui/lib/utils"
import type { Metadata } from "next"
import { headers } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { FeedbackButton } from "@/components/feedback-button"
import { Umami } from "@/components/umami"
import { siteUrl } from "@/lib/seo"
import { SITE } from "@/lib/site"
import { fontVariables } from "./fonts"

/** Guest pages (`GuestShell`) ship none of the site chrome (feedback, consent banner, analytics, background): they must load fast on a weak connection. Umami never runs on them, so they need no banner. */
const GUEST_PATHS = ["/h/", "/u/", "/s/", "/o/", "/r/"]
/** Marketing pages keep the floating feedback button out of the way of the content. */
const NO_FEEDBACK_PATHS = ["/", "/privacy", "/terms"]

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
  const [locale, pathname, t] = await Promise.all([
    getLocale(),
    headers().then((h) => h.get(PATHNAME_HEADER) ?? "/"),
    getTranslations("consentBanner"),
  ])
  const { lang, dir } = htmlAttributes(isLocale(locale) ? locale : DEFAULT_LOCALE)
  return (
    <html
      lang={lang}
      dir={dir}
      suppressHydrationWarning
      className={cn("h-full antialiased", fontVariables, "font-sans")}
    >
      <body className="relative flex min-h-full flex-col bg-background text-foreground">
        {GUEST_PATHS.some((path) => pathname.startsWith(path)) ? (
          children
        ) : (
          <>
            <Umami />
            <QueryProvider>
              <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute inset-x-0 top-0 h-128 bg-glow" />
                <div className="absolute inset-0 bg-dots" />
              </div>
              {children}
              {NO_FEEDBACK_PATHS.includes(pathname) ? null : <FeedbackButton />}
            </QueryProvider>
            <ConsentBanner
              labels={{
                label: t("label"),
                text: t("text"),
                decline: t("decline"),
                accept: t("accept"),
              }}
            />
          </>
        )}
      </body>
    </html>
  )
}
