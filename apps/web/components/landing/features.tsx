import { Chip } from "@ritorno/ui/components/chip"
import { cn } from "@ritorno/ui/lib/utils"
import { CheckIcon, DownloadIcon, GiftIcon, QrCodeIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { Avatar, HOTEL_COLORS, SAMPLE_HOTEL } from "./mockups"
import { CONTAINER, SECTION_Y, SectionHeading } from "./section"

/** A crop of the product on a grey plate; the card's title and text describe it, so the crop is hidden from screen readers. */
function Crop({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-56 select-none items-end overflow-hidden rounded-card bg-foreground/5 px-5 pt-6 md:h-60"
    >
      <div className="w-full rounded-t-2xl border border-b-0 bg-background p-4 shadow-md">{children}</div>
    </div>
  )
}

export async function Features() {
  const [t, consent] = await Promise.all([getTranslations("landing.features"), getTranslations("guests.consent")])
  const items = [
    {
      key: "recognition",
      crop: (
        <div className="grid gap-3 text-start">
          <div className="flex items-center gap-3">
            <Avatar name="Amira Ben Salah" className="size-10" />
            <div className="grid min-w-0 flex-1">
              <span className="truncate font-medium text-small">Amira Ben Salah</span>
              <span className="text-caption text-muted-foreground">{t("recognition.stays", { count: 3 })}</span>
            </div>
            <Chip tone="info">
              <StarIcon />
              {t("recognition.badge")}
            </Chip>
          </div>
          <div className="grid gap-1.5 rounded-xl bg-surface p-3 text-caption">
            <span className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("recognition.lastLabel")}</span>
              <span>{t("recognition.lastValue")}</span>
            </span>
            <span className="flex justify-between gap-2">
              <span className="text-muted-foreground">{t("recognition.noteLabel")}</span>
              <span>{t("recognition.noteValue")}</span>
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "consent",
      crop: (
        <div className="grid gap-2 text-caption">
          <span className="font-medium text-small">{t("consent.log")}</span>
          {[
            { channel: consent("whatsapp"), yes: true, when: "12/03/2026 14:02" },
            { channel: consent("email"), yes: false, when: "12/03/2026 14:02" },
          ].map((row) => (
            <span key={row.channel} className="flex items-center justify-between gap-2 border-t pt-2">
              <span className="grid">
                <span className="font-medium">{row.channel}</span>
                <span className="text-muted-foreground tabular-nums">
                  <bdi dir="ltr">{row.when}</bdi>
                </span>
              </span>
              {row.yes ? (
                <Chip tone="success">
                  <CheckIcon />
                  {t("consent.yes")}
                </Chip>
              ) : (
                <Chip>
                  <XIcon />
                  {t("consent.no")}
                </Chip>
              )}
            </span>
          ))}
          <span className="mt-1 flex gap-2">
            <span className="flex h-8 items-center gap-1.5 rounded-full border px-3 font-medium">
              <DownloadIcon className="size-3.5" />
              {t("consent.export")}
            </span>
            <span className="flex h-8 items-center gap-1.5 rounded-full border px-3 font-medium text-destructive">
              <Trash2Icon className="size-3.5" />
              {t("consent.delete")}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "offers",
      crop: (
        <div className={cn(HOTEL_COLORS, "grid gap-3 text-start")}>
          <span className="text-caption text-muted-foreground">{SAMPLE_HOTEL}</span>
          <span className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <GiftIcon className="size-5" />
            </span>
            <span className="grid gap-0.5">
              <span className="font-medium text-small">{t("offers.offer")}</span>
              <span className="text-caption text-muted-foreground">{t("offers.detail")}</span>
            </span>
          </span>
          <span className="flex items-center justify-between gap-2 rounded-xl bg-surface p-3 text-caption">
            <span className="flex items-center gap-2 font-medium">
              <QrCodeIcon className="size-4" />
              <bdi dir="ltr">DZ-RETOUR</bdi>
            </span>
            <span className="text-muted-foreground">{t("offers.redeemed", { count: 38 })}</span>
          </span>
        </div>
      ),
    },
  ] as const
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className={cn("scroll-mt-20 bg-canvas", SECTION_Y, "pt-0 md:pt-0 lg:pt-0")}
    >
      <div className={CONTAINER}>
        <SectionHeading id="features-title" title={t("title")} lead={t("lead")} />
        <ul className="mt-10 grid gap-10 md:mt-14 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.key} className="md:last:col-span-2 lg:last:col-span-1">
              <Crop>{item.crop}</Crop>
              <h3 className="mt-5 text-h3">{t(`${item.key}.title`)}</h3>
              <p className="mt-1.5 max-w-[40ch] text-muted-foreground text-small">{t(`${item.key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
