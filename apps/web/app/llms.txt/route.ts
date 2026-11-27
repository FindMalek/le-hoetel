import { getTranslations } from "next-intl/server"
import { siteUrl } from "@/lib/seo"
import { SITE } from "@/lib/site"

export const dynamic = "force-dynamic"

const FAQ_KEYS = ["guest", "setup", "whatsapp", "price", "leave", "own"] as const

export async function GET() {
  const [meta, faq] = await Promise.all([
    getTranslations({ locale: "en", namespace: "landing.meta" }),
    getTranslations({ locale: "en", namespace: "landing.faq" }),
  ])
  const base = siteUrl()
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${meta("description")}`,
    "",
    "## Pages",
    `- [Home](${base}/): what ${SITE.name} does, pricing and a free trial request. Also in French (${base}/fr) and Arabic (${base}/ar).`,
    `- [Roadmap and release notes](${base}/roadmap): what is next and what each version added, improved, fixed and removed.`,
    `- [Privacy](${base}/privacy)`,
    `- [Terms](${base}/terms)`,
    `- [Status](${base}/status)`,
    "",
    "## FAQ",
    ...FAQ_KEYS.flatMap((key) => [`- ${faq(`${key}.q`)} ${faq(`${key}.a`)}`]),
    "",
    "## Docs",
    "- Product and developer documentation also serves /llms.txt on the docs site.",
  ]
  return new Response(`${lines.join("\n")}\n`, { headers: { "content-type": "text/plain; charset=utf-8" } })
}
