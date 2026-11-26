import { cn } from "@ritorno/ui/lib/utils"
import { PlusIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { CONTAINER, SECTION_Y } from "./section"

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
    <section id="faq" aria-labelledby="faq-title" className={cn("scroll-mt-20 border-t bg-canvas", SECTION_Y)}>
      <div className={cn(CONTAINER, "grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-16")}>
        <h2 id="faq-title" className="text-balance font-medium text-h1">
          {t("title")}
        </h2>
        <div className="divide-y border-y">
          {items.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background shadow-xs">
                  <PlusIcon
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-45"
                  />
                </span>
              </summary>
              <p className="max-w-[65ch] pb-5 text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
