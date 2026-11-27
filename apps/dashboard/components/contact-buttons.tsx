import { Button } from "@ritorno/ui/components/button"
import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react"
import { useTranslations } from "next-intl"

type ContactButtonsProps = {
  name: string
  phoneE164: string
  /** Only what `contactChannels` allows: null or false hides the button. */
  email: string | null
  whatsapp: boolean
  /** The look of the call button, the others are outline. */
  callVariant?: "default" | "outline"
}

/** Opens the staff member's own dialer, WhatsApp or mail app. Ritorno sends and logs nothing. */
export function ContactButtons({ name, phoneE164, email, whatsapp, callVariant = "default" }: ContactButtonsProps) {
  const t = useTranslations("contact")
  return (
    <>
      <Button
        variant={callVariant}
        render={<a href={`tel:${phoneE164}`} aria-label={t("callName", { name })} />}
        nativeButton={false}
      >
        <PhoneIcon data-icon="inline-start" />
        {t("call")}
      </Button>
      {whatsapp ? (
        <Button
          variant="outline"
          render={
            <a
              href={`https://wa.me/${phoneE164.slice(1)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t("whatsappName", { name })}
            />
          }
          nativeButton={false}
        >
          <MessageCircleIcon data-icon="inline-start" />
          {t("whatsapp")}
        </Button>
      ) : null}
      {email ? (
        <Button
          variant="outline"
          render={<a href={`mailto:${email}`} aria-label={t("emailName", { name })} />}
          nativeButton={false}
        >
          <MailIcon data-icon="inline-start" />
          {t("email")}
        </Button>
      ) : null}
    </>
  )
}
