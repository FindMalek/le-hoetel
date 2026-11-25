import { PlusIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { Section } from "./section"

export async function faqItems() {
  const t = await getTranslations("landing.faq")
  return [
    { q: t("guest.q"), a: t("guest.a") },
    { q: t("setup.q"), a: t("setup.a") },
    { q: t("whatsapp.q"), a: t("whatsapp.a") },
    { q: t("price.q"), a: t("price.a") },
    { q: t("leave.q"), a: t("leave.a") },
    { q: t("own.q"), a: t("own.a") },
  ]
}

export async function Faq() {
  const [t, items] = await Promise.all([getTranslations("landing.faq"), faqItems()])
  return (
    <Section id="faq" title={t("title")}>
      <div className="max-w-3xl divide-y border-y">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <PlusIcon
                aria-hidden
                className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-45"
              />
            </summary>
            <p className="max-w-[65ch] pb-5 text-muted-foreground leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}
