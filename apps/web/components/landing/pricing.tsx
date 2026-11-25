import { cn } from "@ritorno/ui/lib/utils"
import { CheckIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Section } from "./section"

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
    <Section id="pricing" badge={t("badge")} title={t("title")} subtitle={t("subtitle")}>
      <div className="mb-8 grid gap-1 rounded-xl border border-primary/40 bg-primary/5 p-6">
        <p className="font-semibold text-h3 tracking-tight">{t("free")}</p>
        <p className="text-muted-foreground">{t("freeBody")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              "grid content-start gap-5 rounded-xl border p-6",
              plan.popular && "border-primary ring-1 ring-primary",
            )}
          >
            <div className="grid gap-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.popular ? (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 font-medium text-primary-foreground text-xs">
                    {t("popular")}
                  </span>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm">{plan.forWho}</p>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="font-semibold text-4xl tabular-nums tracking-tight">{plan.price}</span>
              <span className="text-muted-foreground text-sm">{t("month")}</span>
            </p>
            <ul className="grid gap-2 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-muted-foreground text-sm leading-relaxed">{t("note")}</p>
    </Section>
  )
}
