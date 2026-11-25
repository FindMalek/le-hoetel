import { nextEnv } from "@ritorno/env/next"
import { alternateUrls, DEFAULT_LOCALE, isLocale, LOCALE_META, LOCALES, localizedPath } from "@ritorno/i18n"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { JsonLd } from "@/components/json-ld"
import { DashboardPreview } from "@/components/landing/dashboard-preview"
import { DemoSection } from "@/components/landing/demo-section"
import { Faq, faqItems } from "@/components/landing/faq"
import { Footer } from "@/components/landing/footer"
import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Pricing } from "@/components/landing/pricing"
import { Trust } from "@/components/landing/trust"
import { siteUrl, websiteJsonLd } from "@/lib/seo"
import { SITE } from "@/lib/site"

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const current = isLocale(locale) ? locale : DEFAULT_LOCALE
  const t = await getTranslations({ locale: current, namespace: "landing.meta" })
  const url = alternateUrls(siteUrl(), "/")[LOCALE_META[current].hreflang]
  return {
    title: { absolute: t("title") },
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
      type: "website",
      siteName: SITE.name,
      url,
      locale: LOCALE_META[current].ogLocale,
      alternateLocale: LOCALES.filter((l) => l !== current).map((l) => LOCALE_META[l].ogLocale),
      images: [
        { url: `${siteUrl()}${localizedPath(current, "/opengraph-image")}`, width: 1200, height: 630, alt: t("title") },
      ],
    },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
  }
}

/** Rendered per request: env (urls, the WhatsApp number) comes from the running container, not the build. */
export default async function HomePage() {
  await connection()
  const [env, t, faq] = await Promise.all([Promise.resolve(nextEnv()), getTranslations("landing.demo"), faqItems()])
  const whatsappUrl = env.WHATSAPP_CONTACT_NUMBER
    ? `https://wa.me/${env.WHATSAPP_CONTACT_NUMBER}?text=${encodeURIComponent(t("whatsappText"))}`
    : null
  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }}
      />
      <Header />
      <main className="flex-1">
        <Hero whatsappUrl={whatsappUrl} />
        <HowItWorks />
        <DashboardPreview />
        <Pricing />
        <Trust />
        <Faq />
        <DemoSection whatsappUrl={whatsappUrl} />
      </main>
      <Footer />
    </>
  )
}
