import { PixelSky } from "@ritorno/ui/brand/pixel-sky"
import { Chip } from "@ritorno/ui/components/chip"
import { cn } from "@ritorno/ui/lib/utils"
import {
  BellRingIcon,
  ConciergeBellIcon,
  GiftIcon,
  PhoneIcon,
  QrCodeIcon,
  RotateCcwIcon,
  StarIcon,
  UserPlusIcon,
  UtensilsIcon,
} from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import type { ComponentType, ReactNode } from "react"
import { JourneyChecklist } from "./journey-checklist"
import { Avatar, SAMPLE_HOTEL } from "./mockups"
import { CONTAINER, SECTION_Y, SectionHeading } from "./section"

const STEPS = [
  { key: "joined", day: 12, time: "14:02" },
  { key: "welcome", day: 12, time: "14:02" },
  { key: "birthday", day: 13, time: "09:00" },
  { key: "checkout", day: 15, time: "11:30" },
  { key: "survey", day: 15, time: "18:45" },
  { key: "alerted", day: 15, time: "18:46" },
  { key: "called", day: 15, time: "19:10" },
  { key: "happy", day: 15, time: "19:24" },
  { key: "review", day: 15, time: "19:25" },
] as const

/**
 * Columns are 1fr 1.2fr 1fr with 6% gaps, so their centers (13.75, 50, 86.25) and the gap middles (30.5, 69.5) are
 * fixed fractions of the grid. The side cards are centered in three equal rows (16.7, 50, 83.3). Lines run center to
 * center behind the opaque cards, so only the hairlines in the gaps show.
 */
const LINES = ["M13.75 16.7 H30.5 V83.3 H13.75", "M13.75 50 H86.25", "M86.25 16.7 H69.5 V83.3 H86.25"]

/** A white card with hoplite's small folder tab holding an icon. */
function Card({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative mt-4 rounded-card border bg-background p-4 shadow-xs", className)}>
      <span
        aria-hidden
        className="absolute -top-4 start-4 grid h-4 w-8 place-items-center rounded-t-md border border-b-0 bg-background"
      >
        <Icon className="size-3 text-ink-400" />
      </span>
      <h3 className="font-medium text-small">{title}</h3>
      {children ? <div className="mt-3 text-caption">{children}</div> : null}
    </div>
  )
}

/** Side column: three rows on desktop, a horizontal snap carousel on phones. */
function Column({ label, children, className }: { label: string; children: ReactNode[]; className?: string }) {
  return (
    <section aria-label={label} className={cn("min-w-0", className)}>
      <h3 className="mb-1 px-4 text-caption text-muted-foreground lg:sr-only">{label}</h3>
      <ul
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable carousel must be reachable by keyboard
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring lg:mx-0 lg:grid lg:h-full lg:grid-rows-3 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {children.map((child, index) => (
          <li key={index} className="w-4/5 max-w-72 shrink-0 snap-start sm:w-72 lg:w-auto lg:max-w-none lg:self-center">
            {child}
          </li>
        ))}
      </ul>
    </section>
  )
}

export async function HowItWorks({ docsUrl }: { docsUrl: string }) {
  const [t, survey, locale] = await Promise.all([
    getTranslations("landing.how"),
    getTranslations("survey"),
    getLocale(),
  ])
  const stars = (count: number) => (
    <span className="flex gap-0.5 text-warning" role="img" aria-label={t("stars", { count })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} aria-hidden className={cn("size-3.5", n <= count ? "fill-current" : "text-ink-400")} />
      ))}
    </span>
  )
  // The stay spans four days, so each time carries its day to read in order.
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" })
  const steps = STEPS.map((step) => ({
    label: t(`hub.steps.${step.key}`),
    time: `${day.format(Date.UTC(2026, 2, step.day))} ${step.time}`,
  }))
  const progress = Array.from({ length: steps.length + 1 }, (_, done) =>
    t("hub.progress", { done, total: steps.length }),
  )
  return (
    <section id="how" aria-labelledby="how-title" className={`scroll-mt-20 bg-canvas ${SECTION_Y}`}>
      <div className={CONTAINER}>
        <SectionHeading id="how-title" title={t("title")} lead={t("lead")} link={{ href: docsUrl, label: t("link") }} />
        <div className="relative isolate mt-10 overflow-hidden rounded-panel bg-surface px-4 py-6 md:mt-14 md:p-8 lg:px-10 lg:py-12">
          <div aria-hidden className="absolute -end-10 -bottom-10 -z-10 size-96 mask-corner-end md:size-144">
            <div className="absolute inset-0 rotate-180">
              <PixelSky animated={false} />
            </div>
          </div>
          <svg
            aria-hidden
            focusable="false"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-x-10 inset-y-12 hidden h-[calc(100%-6rem)] w-[calc(100%-5rem)] text-foreground/20 lg:block rtl:-scale-x-100"
          >
            {LINES.map((d) => (
              <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="relative flex flex-col gap-8 lg:grid lg:grid-cols-[1fr_1.2fr_1fr] lg:gap-x-[6%] lg:gap-y-0">
            <Column label={t("inputsLabel")}>
              {[
                <Card key="room" icon={QrCodeIcon} title={t("inputs.room.title")}>
                  <span className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface">
                      <QrCodeIcon aria-hidden className="size-6" />
                    </span>
                    <span className="grid">
                      <span className="font-medium">{SAMPLE_HOTEL}</span>
                      <span className="text-muted-foreground">{t("inputs.room.body")}</span>
                    </span>
                  </span>
                </Card>,
                <Card key="table" icon={UtensilsIcon} title={t("inputs.table.title")}>
                  <span className="flex flex-wrap gap-1.5">
                    <Chip>
                      <ConciergeBellIcon />
                      {t("inputs.table.desk")}
                    </Chip>
                    <Chip>
                      <UtensilsIcon />
                      {t("inputs.table.table")}
                    </Chip>
                  </span>
                </Card>,
                <Card key="staff" icon={UserPlusIcon} title={t("inputs.staff.title")}>
                  <span className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
                    <span className="truncate">Youssef Trabelsi</span>
                    <bdi dir="ltr" className="text-muted-foreground tabular-nums">
                      +216 22 418 903
                    </bdi>
                  </span>
                </Card>,
              ]}
            </Column>
            <div className="max-lg:order-first lg:self-center">
              <div className="rounded-card border bg-background p-5 shadow-md md:p-6">
                <div className="mb-4 flex items-center gap-3 border-b pb-4">
                  <Avatar name="Amira Ben Salah" className="size-10" />
                  <div className="grid min-w-0 flex-1">
                    <h3 className="truncate font-medium">Amira Ben Salah</h3>
                    <span className="text-caption text-muted-foreground">{t("hub.stay")}</span>
                  </div>
                  <Chip>{t("hub.nights")}</Chip>
                </div>
                <JourneyChecklist steps={steps} progress={progress} />
              </div>
            </div>
            <Column label={t("outcomesLabel")}>
              {[
                <Card key="alert" icon={BellRingIcon} title={t("outcomes.alert.title")}>
                  <span className="flex items-center justify-between gap-2">
                    {stars(2)}
                    <span className="text-muted-foreground">{t("outcomes.alert.room")}</span>
                  </span>
                  <span className="mt-2 block text-pretty">{t("outcomes.alert.quote")}</span>
                  <span className="mt-3 flex h-8 w-fit items-center gap-1.5 rounded-full bg-foreground px-3 font-medium text-background">
                    <PhoneIcon aria-hidden className="size-3.5" />
                    {t("outcomes.alert.action")}
                  </span>
                </Card>,
                <Card key="review" icon={StarIcon} title={t("outcomes.review.title")}>
                  <span className="flex items-center justify-between gap-2">
                    {stars(5)}
                    <span className="flex h-8 items-center rounded-full border bg-background px-3 font-medium">
                      {survey("shareOnGoogle")}
                    </span>
                  </span>
                </Card>,
                <Card key="return" icon={RotateCcwIcon} title={t("outcomes.return.title")}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip tone="info">
                      <StarIcon />
                      {t("outcomes.return.badge")}
                    </Chip>
                    <Chip tone="success">
                      <GiftIcon />
                      {t("outcomes.return.offer")}
                    </Chip>
                  </span>
                  <span className="mt-2 block text-muted-foreground">{t("outcomes.return.when")}</span>
                </Card>,
              ]}
            </Column>
          </div>
        </div>
      </div>
    </section>
  )
}
