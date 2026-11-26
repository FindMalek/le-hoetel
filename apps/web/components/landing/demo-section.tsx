import { HOTEL_LANGUAGES } from "@ritorno/common/hotel"
import { Display } from "@ritorno/ui/brand/display"
import { buttonVariants } from "@ritorno/ui/components/button"
import { cn } from "@ritorno/ui/lib/utils"
import { MessageCircleIcon } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"
import { DemoForm } from "./demo-form"
import { CONTAINER, SECTION_Y } from "./section"

/** The closing call to action: one centered display line, the demo form and the WhatsApp shortcut. */
export async function DemoSection({ whatsappUrl }: { whatsappUrl: string | null }) {
  const [t, locale] = await Promise.all([getTranslations("landing.demo"), getLocale()])
  const language = HOTEL_LANGUAGES.find((l) => l === locale) ?? "fr"
  return (
    <section
      id="demo"
      aria-labelledby="demo-title"
      className={cn("relative isolate scroll-mt-20 overflow-hidden border-t bg-canvas", SECTION_Y)}
    >
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-2/3 bg-soft-glow opacity-70 blur-3xl" />
      <div className={cn(CONTAINER, "flex flex-col items-center text-center")}>
        <Display as="h2" id="demo-title" className="max-w-[18ch]">
          {t.rich("title", { em: (chunks) => <em>{chunks}</em> })}
        </Display>
        <p className="mt-5 max-w-lg text-pretty text-lead text-muted-foreground">{t("subtitle")}</p>
        <div className="mt-10 w-full max-w-xl text-start md:mt-12">
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
        {whatsappUrl ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-muted-foreground text-small">{t("whatsappLead")}</p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "px-6")}
            >
              <MessageCircleIcon data-icon="inline-start" />
              {t("whatsapp")}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}
