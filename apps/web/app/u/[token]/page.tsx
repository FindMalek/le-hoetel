import { consentWording } from "@le-hoetel/common/consent"
import { getDirection } from "@le-hoetel/i18n"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { GuestHero } from "@/components/guest-hero"
import { getUnsubscribePage } from "@/lib/api"
import { guestBrand } from "@/lib/branding"
import { UnsubscribeForm } from "./unsubscribe-form"

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function Page({ params }: PageProps<"/u/[token]">) {
  await connection()
  const { token } = await params
  const page = await getUnsubscribePage(token)

  if (!page) {
    const t = await getTranslations("unsubscribe")
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-2 px-5 py-10">
        <h1 className="font-semibold text-h2 tracking-tight">{t("invalidTitle")}</h1>
        <p className="text-muted-foreground leading-relaxed">{t("invalid")}</p>
      </main>
    )
  }

  const t = await getTranslations({ locale: page.language, namespace: "unsubscribe" })
  const hotel = page.hotel.displayName
  return (
    <div
      lang={page.language}
      dir={getDirection(page.language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={guestBrand(page.hotel)}
      className="min-h-dvh"
    >
      <GuestHero hotel={page.hotel} />
      <main className="mx-auto grid w-full max-w-md gap-6 px-5 py-8">
        <div className="grid gap-2">
          <h2 className="text-balance font-semibold text-h3 tracking-tight">{t("title", { hotel })}</h2>
          <p className="text-muted-foreground leading-relaxed">{t("intro", { hotel })}</p>
        </div>
        <UnsubscribeForm
          token={token}
          initial={page.channels}
          wording={Object.fromEntries(
            page.channels.map(({ channel }) => [channel, consentWording(channel, page.language, hotel)]),
          )}
          copy={{
            email: t("email"),
            whatsapp: t("whatsapp"),
            turnsOn: t("consentOn", { wording: "{wording}" }),
            stopAll: t("stopAll"),
            stoppedTitle: t("stoppedTitle"),
            stopped: t("stopped", { hotel }),
            saved: t("saved"),
            error: t("error"),
          }}
        />
      </main>
    </div>
  )
}
