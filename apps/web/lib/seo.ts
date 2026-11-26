import { SITE } from "./site"

/** Pages that carry a token or a guest's data, or belong to the app: never crawled. */
export const PRIVATE_PATHS = ["/h/", "/q/", "/s/", "/u/", "/o/", "/api/"]

/** The public origin, read per request so one build serves every environment. */
export function siteUrl(): string {
  return (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "")
}

/** Previews and local runs stay out of search results. */
export function isIndexable(): boolean {
  return !process.env.DEPLOY_ENV?.startsWith("pr-") && new URL(siteUrl()).hostname !== "localhost"
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl()}/#website`,
        url: siteUrl(),
        name: SITE.name,
        description: SITE.tagline,
      },
      { "@type": "Organization", "@id": `${siteUrl()}/#organization`, url: siteUrl(), name: SITE.name },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl()}/#software`,
        name: SITE.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: SITE.tagline,
        inLanguage: ["en", "fr", "ar"],
        publisher: { "@id": `${siteUrl()}/#organization` },
      },
    ],
  }
}
