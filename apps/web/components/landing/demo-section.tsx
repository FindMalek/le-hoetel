import { HOTEL_LANGUAGES } from "@le-hoetel/common/hotel"
import { buttonVariants } from "@le-hoetel/ui/components/button"
import { cn } from "@le-hoetel/ui/lib/utils"
import { MessageCircleIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { DemoForm } from "./demo-form"
import { CONTAINER } from "./section"

export async function DemoSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const [t, locale] = await Promise.all([getTranslations("landing.demo"), getLocale()])
  const language = HOTEL_LANGUAGES.find((l) => l === locale) ?? "fr"
  return (
    <section id="demo" className="scroll-mt-16 border-t bg-muted/40">
      <div className={`${CONTAINER} grid gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24`}>
        <div className="grid content-start gap-4">
          <h2 className="text-balance font-semibold text-h2 tracking-tight">{t("title")}</h2>
          <p className="max-w-[65ch] text-muted-foreground leading-relaxed">{t("subtitle")}</p>
          {whatsappUrl ? (
            <div className="mt-4 grid gap-3 border-t pt-6">
              <p className="text-muted-foreground text-sm">{t("whatsappLead")}</p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-12 w-fit bg-background px-6")}
              >
                <MessageCircleIcon data-icon="inline-start" />
                {t("whatsapp")}
              </a>
            </div>
          ) : null}
        </div>
        <DemoForm
          language={language}
          copy={{
            name: t("name"),
            nameError: t("nameError"),
            hotel: t("hotel"),
            hotelError: t("hotelError"),
            phone: t("phone"),
            phoneError: t("phoneError"),
            dialCode: t("dialCode"),
            city: t("city"),
            cityError: t("cityError"),
            language: t("language"),
            submit: t("submit"),
            hint: t("hint"),
            thanksTitle: t("thanksTitle", { name: "{name}" }),
            thanksBody: t("thanksBody"),
            errorInvalid: t("errorInvalid"),
            errorTooMany: t("errorTooMany"),
          }}
        />
      </div>
    </section>
  )
}
