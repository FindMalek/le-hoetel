import { Chip } from "@ritorno/ui/components/chip"
import { cn } from "@ritorno/ui/lib/utils"
import { CheckIcon, GiftIcon, SparklesIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { CONTAINER, SECTION_Y, SectionHeading } from "./section"

export async function Pricing() {
  const t = await getTranslations("landing.pricing")
  const plans = [
    {
      name: t("starter.name"),
      forWho: t("starter.for"),
      price: "99",
      features: [t("starter.f1"), t("starter.f2"), t("starter.f3")],
      popular: false,
    },
    {
      name: t("growth.name"),
      forWho: t("growth.for"),
      price: "249",
      features: [t("growth.f1"), t("growth.f2"), t("growth.f3")],
      popular: true,
    },
    {
      name: t("pro.name"),
      forWho: t("pro.for"),
      price: "549",
      features: [t("pro.f1"), t("pro.f2"), t("pro.f3")],
      popular: false,
    },
  ]
  return (
    <section id="pricing" aria-labelledby="pricing-title" className={cn("scroll-mt-20 border-t bg-canvas", SECTION_Y)}>
      <div className={CONTAINER}>
        <Chip className="mb-4 bg-background">{t("badge")}</Chip>
        <SectionHeading id="pricing-title" title={t("title")} lead={t("subtitle")} />
        <div className="mt-10 flex items-start gap-4 rounded-card border bg-background p-5 md:mt-14 md:items-center md:p-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <GiftIcon aria-hidden className="size-5" />
          </span>
          <div className="grid gap-0.5">
            <p className="font-medium">{t("free")}</p>
            <p className="text-muted-foreground text-small">{t("freeBody")}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "grid content-start gap-6 rounded-card border bg-background p-6",
                plan.popular && "border-blue-500 bg-blue-50 ring-1 ring-blue-500",
              )}
            >
              <div className="grid gap-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-h3">{plan.name}</h3>
                  {plan.popular ? (
                    <Chip tone="info" className="bg-background">
                      <SparklesIcon aria-hidden />
                      {t("popular")}
                    </Chip>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-small">{plan.forWho}</p>
              </div>
              <p className="flex items-baseline gap-2">
                <span className="font-semibold text-5xl tabular-nums tracking-tight">{plan.price}</span>
                <span className="text-muted-foreground text-small">{t("month")}</span>
              </p>
              <ul className="grid gap-2.5 border-t pt-5 text-small">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-blue-700" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-muted-foreground text-small">{t("note")}</p>
      </div>
    </section>
  )
}
