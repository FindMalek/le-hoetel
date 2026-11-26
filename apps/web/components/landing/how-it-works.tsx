import { BentoGrid, BentoTile } from "@ritorno/ui/brand/bento"
import { Chip } from "@ritorno/ui/components/chip"
import { cn } from "@ritorno/ui/lib/utils"
import {
  BellRingIcon,
  ClipboardListIcon,
  MessageCircleIcon,
  PhoneIcon,
  QrCodeIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { Avatar, ConsentChips, SAMPLE_HOTEL } from "./mockups"
import { CONTAINER, SECTION_Y, SectionHeading } from "./section"

/**
 * Centers of the four lg columns (6% gaps) and of the gaps between them, in percent of the grid's content box.
 * The lines run center to center behind the opaque tiles, so only the part in the gaps shows.
 */
const LINES = [
  "M10.25 25 V75",
  "M10.25 75 H23.5 V50 H36.75",
  "M36.75 50 H63.25",
  "M63.25 50 H76.5 V25 H89.75",
  "M76.5 50 V75 H89.75",
]

function Mini({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-3 mb-3 flex flex-1 flex-col gap-2 rounded-2xl bg-surface p-3 text-caption", className)}>
      {children}
    </div>
  )
}

export async function HowItWorks({ docsUrl }: { docsUrl: string }) {
  const [t, survey] = await Promise.all([getTranslations("landing.how"), getTranslations("survey")])
  const stars = (count: number) => (
    <span className="flex gap-0.5 text-warning" role="img" aria-label={t("stars", { count })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} aria-hidden className={cn("size-3.5", n <= count ? "fill-current" : "text-ink-400")} />
      ))}
    </span>
  )
  return (
    <section id="how" aria-labelledby="how-title" className={`scroll-mt-20 bg-canvas ${SECTION_Y}`}>
      <div className={CONTAINER}>
        <SectionHeading id="how-title" title={t("title")} lead={t("lead")} link={{ href: docsUrl, label: t("link") }} />
        <BentoGrid className="relative mt-10 gap-4 p-3 md:mt-14 md:grid-cols-1 md:gap-4 md:p-4 lg:grid-cols-[repeat(4,minmax(0,1fr))] lg:grid-rows-2 lg:gap-x-[6%] lg:gap-y-4 lg:p-8">
          <span aria-hidden className="absolute inset-y-8 start-9 w-px bg-foreground/15 md:start-10 lg:hidden" />
          <svg
            aria-hidden
            focusable="false"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-8 hidden size-[calc(100%-4rem)] text-foreground/15 lg:block rtl:-scale-x-100"
          >
            {LINES.map((d) => (
              <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <BentoTile
            className="md:col-span-1 lg:col-start-1 lg:row-start-1 lg:self-center"
            chips={
              <Chip>
                <QrCodeIcon />
                {t("qr.chip")}
              </Chip>
            }
            title={t("qr.title")}
            description={t("qr.body")}
            media={
              <Mini className="flex-row items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-background shadow-xs">
                  <QrCodeIcon aria-hidden className="size-7" />
                </span>
                <span className="grid">
                  <span className="font-medium">{SAMPLE_HOTEL}</span>
                  <span className="text-muted-foreground">{t("qr.place")}</span>
                </span>
              </Mini>
            }
          />
          <BentoTile
            className="md:col-span-1 lg:col-start-1 lg:row-start-2 lg:self-center"
            chips={
              <Chip>
                <UsersIcon />
                {t("list.chip")}
              </Chip>
            }
            title={t("list.title")}
            description={t("list.body")}
            media={
              <Mini>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name="Amira Ben Salah" className="size-7" />
                  <span className="truncate font-medium">Amira Ben Salah</span>
                </span>
                <ConsentChips whatsapp email={false} />
              </Mini>
            }
          />
          <BentoTile
            className="md:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
            chips={
              <Chip tone="success">
                <MessageCircleIcon />
                {t("welcome.chip")}
              </Chip>
            }
            title={t("welcome.title")}
            description={t("welcome.body")}
            media={
              <Mini>
                <span className="max-w-[92%] rounded-2xl rounded-ss-sm bg-background p-2.5 leading-snug shadow-xs">
                  {t("welcome.message", { name: "Amira", hotel: SAMPLE_HOTEL })}
                  <span className="mt-1 block text-end text-muted-foreground tabular-nums">
                    <bdi dir="ltr">09:41</bdi>
                  </span>
                </span>
              </Mini>
            }
          />
          <BentoTile
            className="md:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-center"
            chips={
              <Chip>
                <ClipboardListIcon />
                {t("survey.chip")}
              </Chip>
            }
            title={t("survey.title")}
            description={t("survey.body")}
            media={
              <Mini>
                <span className="font-medium">{survey("title")}</span>
                {stars(4)}
              </Mini>
            }
          />
          <BentoTile
            className="md:col-span-1 lg:col-start-4 lg:row-start-1 lg:self-center"
            chips={
              <Chip tone="warning">
                <BellRingIcon />
                {t("alert.chip")}
              </Chip>
            }
            title={t("alert.title")}
            description={t("alert.body")}
            media={
              <Mini>
                <span className="flex items-center justify-between gap-2">
                  {stars(2)}
                  <span className="text-muted-foreground">{t("alert.room")}</span>
                </span>
                <span className="text-pretty">{t("alert.quote")}</span>
                <span className="flex h-8 w-fit items-center gap-1.5 rounded-full bg-foreground px-3 font-medium text-background">
                  <PhoneIcon aria-hidden className="size-3.5" />
                  {t("alert.action")}
                </span>
              </Mini>
            }
          />
          <BentoTile
            className="md:col-span-1 lg:col-start-4 lg:row-start-2 lg:self-center"
            chips={
              <Chip tone="success">
                <StarIcon />
                {t("review.chip")}
              </Chip>
            }
            title={t("review.title")}
            description={t("review.body")}
            media={
              <Mini className="flex-row items-center justify-between">
                {stars(5)}
                <span className="flex h-8 items-center rounded-full border bg-background px-3 font-medium">
                  {survey("shareOnGoogle")}
                </span>
              </Mini>
            }
          />
        </BentoGrid>
      </div>
    </section>
  )
}
