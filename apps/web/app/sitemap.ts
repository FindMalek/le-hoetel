import { alternateUrls, LOCALES, localizedPath } from "@le-hoetel/i18n"
import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/seo"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = ["/"]
  paths.push("/privacy", "/terms")
  paths.push("/status")
  paths.push(...LOCALES.slice(1).flatMap((locale) => paths.map((path) => localizedPath(locale, path))))
  return paths.map((path) => ({
    url: `${siteUrl()}${path === "/" ? "" : path}`,
    alternates: { languages: alternateUrls(siteUrl(), path) },
  }))
}
