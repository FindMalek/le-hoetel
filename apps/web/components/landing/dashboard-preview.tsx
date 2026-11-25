import { cn } from "@ritorno/ui/lib/utils"
import { PhoneIcon, TriangleAlertIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Mark } from "./header"
import { Section } from "./section"

const BARS = ["h-10", "h-14", "h-12", "h-20", "h-16", "h-24", "h-28"]

export async function DashboardPreview() {
  const t = await getTranslations("landing.preview")
  const delta = (value: string) => t("delta", { value: `\u2066${value}\u2069` })
  const stats = [
    { label: t("newGuests"), value: "128", delta: delta("+18%") },
    { label: t("score"), value: "4.6", delta: delta("+0.2") },
    { label: t("invited"), value: "41", delta: delta("+9") },
  ]
  const guests = [
    { name: "Sami B.", place: t("room", { place: "112" }), whatsapp: true, email: false },
    { name: "Nour K.", place: t("table", { place: "7" }), whatsapp: true, email: true },
    { name: "Julien M.", place: t("desk"), whatsapp: false, email: true },
  ]
  return (
    <Section title={t("title")} subtitle={t("subtitle")}>
      <div role="img" aria-label={t("label")} className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Mark className="size-4 text-primary" />
            Dar Zitouna
            <span className="text-muted-foreground">/ {t("week")}</span>
          </div>
          <span className="rounded-full border bg-muted px-2.5 py-0.5 text-muted-foreground text-xs">
            {t("sample")}
          </span>
        </div>
        <div className="grid gap-6 p-4 md:grid-cols-3 md:p-6">
          <div className="grid grid-rows-[auto_1fr] gap-6 md:col-span-2">
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="grid gap-1 rounded-lg border p-3 md:p-4">
                  <span className="text-muted-foreground text-xs">{stat.label}</span>
                  <span className="font-semibold text-2xl tabular-nums tracking-tight md:text-3xl">{stat.value}</span>
                  <span className="text-muted-foreground text-xs">{stat.delta}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-rows-[auto_1fr] gap-3 rounded-lg border p-4">
              <span className="font-medium text-sm">{t("chart")}</span>
              <div className="flex min-h-32 items-end gap-2 border-b md:gap-3">
                {BARS.map((height, index) => (
                  <div key={index} className={cn("flex-1 rounded-t-sm bg-primary/80", height)} />
                ))}
              </div>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div className="grid gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 font-medium text-destructive text-sm">
                <TriangleAlertIcon aria-hidden className="size-4" />
                {t("alertTitle")}
              </div>
              <p className="text-sm leading-relaxed">{t("alertBody")}</p>
              <span className="inline-flex h-9 w-fit items-center gap-2 rounded-lg bg-primary px-3 font-medium text-primary-foreground text-sm">
                <PhoneIcon aria-hidden className="size-4" />
                {t("alertAction")}
              </span>
            </div>
            <div className="grid gap-1 rounded-lg border p-4">
              <span className="mb-2 font-medium text-sm">{t("latest")}</span>
              {guests.map((guest) => (
                <div
                  key={guest.name}
                  className="flex items-center justify-between gap-3 border-t py-2 text-sm first:border-t-0"
                >
                  <div className="grid">
                    <span className="font-medium">{guest.name}</span>
                    <span className="text-muted-foreground text-xs">{guest.place}</span>
                  </div>
                  <div className="flex gap-1.5 text-xs">
                    {guest.whatsapp ? <span className="rounded-full bg-muted px-2 py-0.5">{t("whatsapp")}</span> : null}
                    {guest.email ? <span className="rounded-full bg-muted px-2 py-0.5">{t("email")}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
