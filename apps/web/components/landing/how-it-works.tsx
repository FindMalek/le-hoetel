import { getTranslations } from "next-intl/server"
import { Section } from "./section"

export async function HowItWorks() {
  const t = await getTranslations("landing.how")
  const steps = [
    { title: t("qr.title"), body: t("qr.body") },
    { title: t("messages.title"), body: t("messages.body") },
    { title: t("feedback.title"), body: t("feedback.body") },
  ]
  return (
    <Section id="how" title={t("title")} subtitle={t("subtitle")}>
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, index) => (
          <li key={step.title} className="grid content-start gap-3 border-t-2 border-primary pt-5">
            <p className="font-medium text-muted-foreground text-sm tabular-nums">{t("step", { number: index + 1 })}</p>
            <h3 className="font-semibold text-h3 tracking-tight">{step.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
