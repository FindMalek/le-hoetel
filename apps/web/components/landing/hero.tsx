import { Button } from "@le-hoetel/ui/components/button"
import { MessageCircleIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Zellige } from "../zellige"
import { CONTAINER } from "./section"

export async function Hero({ whatsappUrl }: { whatsappUrl: string | null }) {
  const t = await getTranslations("landing")
  const outcomes = [
    { title: t("outcomes.alerts.title"), body: t("outcomes.alerts.body") },
    { title: t("outcomes.reviews.title"), body: t("outcomes.reviews.body") },
    { title: t("outcomes.list.title"), body: t("outcomes.list.body") },
  ]
  return (
    <section id="top" className="relative isolate overflow-hidden bg-background">
      <Zellige className="-z-10 text-primary/10" />
      <div className={`${CONTAINER} pt-14 pb-12 md:pt-24 md:pb-16`}>
        <div className="grid max-w-3xl gap-6">
          <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide rtl:tracking-normal rtl:normal-case">{t("hero.eyebrow")}</p>
          <h1 className="text-balance font-bold text-display tracking-tight rtl:leading-snug">{t("hero.title")}</h1>
          <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">{t("hero.subtitle")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" render={<a href="#demo" />} nativeButton={false} className="min-h-12 px-6">
              {t("hero.demo")}
            </Button>
            {whatsappUrl ? (
              <Button
                size="lg"
                variant="outline"
                render={<a href={whatsappUrl} target="_blank" rel="noreferrer" />}
                nativeButton={false}
                className="min-h-12 bg-background px-6"
              >
                <MessageCircleIcon data-icon="inline-start" />
                {t("hero.whatsapp")}
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">{t("hero.note")}</p>
        </div>
        <dl className="mt-14 grid gap-px overflow-hidden rounded-xl border bg-border md:mt-20 md:grid-cols-3">
          {outcomes.map((outcome) => (
            <div key={outcome.title} className="grid content-start gap-2 bg-background p-6">
              <dt className="font-semibold">{outcome.title}</dt>
              <dd className="text-muted-foreground text-sm leading-relaxed">{outcome.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
