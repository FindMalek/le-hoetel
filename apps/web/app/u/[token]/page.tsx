import { consentWording } from "@le-hoetel/common/consent"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import type { CSSProperties } from "react"
import { getUnsubscribePage } from "@/lib/api"
import { brandColor } from "./brand"
import { UnsubscribeForm } from "./unsubscribe-form"

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function Page({ params }: PageProps<"/u/[token]">) {
  await connection()
  const { token } = await params
  const [t, page] = await Promise.all([getTranslations("unsubscribe"), getUnsubscribePage(token)])

  if (!page) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{t("invalidTitle")}</CardTitle>
            <CardDescription>{t("invalid")}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  const hotel = page.hotel.displayName
  const primary = brandColor(page.hotel.primaryColor)
  const accent = brandColor(page.hotel.accentColor)
  return (
    <main
      style={
        {
          "--primary": primary?.color,
          "--primary-foreground": primary?.on,
          "--ring": primary?.color,
          "--accent": accent?.color,
          "--accent-foreground": accent?.on,
        } as CSSProperties
      }
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10"
    >
      <Card>
        <CardHeader>
          {page.hotel.logoUrl ? (
            // biome-ignore lint/performance/noImgElement: the logo is a hotel upload served by the api, not a static asset
            <img src={page.hotel.logoUrl} alt={hotel} className="mb-2 h-12 w-auto self-start object-contain" />
          ) : null}
          <CardTitle className="text-xl">{t("title", { hotel })}</CardTitle>
          <CardDescription>{t("intro", { hotel })}</CardDescription>
        </CardHeader>
        <CardContent>
          <UnsubscribeForm
            token={token}
            initial={page.channels}
            wording={Object.fromEntries(
              page.channels.map(({ channel }) => [
                channel,
                t("consentOn", { wording: consentWording(channel, page.language, hotel) }),
              ]),
            )}
            copy={{
              email: t("email"),
              whatsapp: t("whatsapp"),
              stopAll: t("stopAll"),
              stoppedTitle: t("stoppedTitle"),
              stopped: t("stopped", { hotel }),
              saved: t("saved"),
              error: t("error"),
            }}
          />
        </CardContent>
      </Card>
    </main>
  )
}
