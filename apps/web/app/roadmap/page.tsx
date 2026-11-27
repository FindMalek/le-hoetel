import { nextEnv } from "@ritorno/env/next"
import { DEFAULT_LOCALE, isLocale, localizedPath } from "@ritorno/i18n"
import { Display } from "@ritorno/ui/brand/display"
import { Chip } from "@ritorno/ui/components/chip"
import { ArrowUpRightIcon, type LucideIcon, MinusIcon, PlusIcon, TrendingUpIcon, WrenchIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getLocale, getTranslations } from "next-intl/server"
import { Footer } from "@/components/landing/footer"
import { Header } from "@/components/landing/header"
import { CONTAINER, SectionHeading } from "@/components/landing/section"
import { CHANGE_GROUPS, type ChangeGroup, NEXT, RELEASES, type Release } from "@/lib/releases"
import { isUpcoming } from "@/lib/version"
import { whatsappContactUrl } from "@/lib/whatsapp"
import { version as deployed } from "../../../../package.json"

const ICONS: Record<ChangeGroup, LucideIcon> = {
  added: PlusIcon,
  improved: TrendingUpIcon,
  fixed: WrenchIcon,
  removed: MinusIcon,
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing.roadmap")
  return { title: t("title"), description: t("lead") }
}

async function ReleaseNotes({ release }: { release: Release }) {
  const [t, current] = await Promise.all([getTranslations("landing.roadmap"), getLocale()])
  const locale = isLocale(current) ? current : DEFAULT_LOCALE
  const id = `v${release.version.replaceAll(".", "-")}`
  return (
    <article
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-24 gap-4 border-t py-10 md:grid-cols-4 md:gap-10"
    >
      <header className="flex flex-wrap items-center gap-3 md:sticky md:top-24 md:flex-col md:items-start md:self-start">
        <h3 id={`${id}-title`} className="font-medium text-h2 tabular-nums">
          <bdi dir="ltr">{release.version}</bdi>
        </h3>
        {isUpcoming(release.version, deployed) ? <Chip tone="info">{t("upcoming")}</Chip> : null}
      </header>
      <div className="grid min-w-0 gap-5 md:col-span-3">
        <p className="max-w-2xl text-pretty text-lead">{release.summary[locale]}</p>
        {CHANGE_GROUPS.map((group) => {
          const items = release[group]
          if (!items) return null
          const Icon = ICONS[group]
          return (
            <div key={group} className="rounded-card border bg-background p-5 md:p-6">
              <h4 className="flex items-center gap-2 font-medium">
                <Icon aria-hidden className="size-4 text-blue-600" />
                {t(`groups.${group}`)}
              </h4>
              <ul className="mt-3 grid list-disc gap-2 ps-5 text-muted-foreground text-small marker:text-ink-400">
                {items.map((item) => (
                  <li key={item.en} className="text-pretty">
                    {item[locale]}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default async function RoadmapPage() {
  await connection()
  const [t, current] = await Promise.all([getTranslations("landing.roadmap"), getLocale()])
  const locale = isLocale(current) ? current : DEFAULT_LOCALE
  const env = nextEnv()
  const home = localizedPath(locale, "/")
  const whatsappUrl = await whatsappContactUrl(env.WHATSAPP_CONTACT_NUMBER)
  return (
    <>
      <Header docsUrl={env.DOCS_URL} dashboardUrl={env.DASHBOARD_URL} home={home} />
      <main className="flex-1 bg-canvas pt-28 pb-20 md:pt-36 md:pb-28">
        <div className={CONTAINER}>
          <Display as="h1" className="text-balance">
            {t("title")}
          </Display>
          <p className="mt-4 max-w-xl text-pretty text-lead text-muted-foreground">{t("lead")}</p>

          <section aria-labelledby="next-title" className="mt-14 md:mt-20">
            <SectionHeading id="next-title" title={t("next.title")} lead={t("next.lead")} />
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {NEXT.map((plan) => (
                <li key={plan.title.en} className="rounded-card border bg-background p-5 shadow-xs md:p-6">
                  <h3 className="flex items-center gap-2 font-medium text-h3">
                    <ArrowUpRightIcon aria-hidden className="size-5 shrink-0 text-blue-600 rtl:-scale-x-100" />
                    {plan.title[locale]}
                  </h3>
                  <ul className="mt-3 grid list-disc gap-2 ps-5 text-muted-foreground text-small marker:text-ink-400">
                    {plan.items.map((item) => (
                      <li key={item.en} className="text-pretty">
                        {item[locale]}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {/* A release email sign-up would sit between these two sections, once decided. */}

          <section aria-labelledby="releases-title" className="mt-20 md:mt-28">
            <SectionHeading id="releases-title" title={t("releases.title")} lead={t("releases.lead")} />
            <div className="mt-8">
              {RELEASES.map((release) => (
                <ReleaseNotes key={release.version} release={release} />
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer docsUrl={env.DOCS_URL} whatsappUrl={whatsappUrl} home={home} />
    </>
  )
}
