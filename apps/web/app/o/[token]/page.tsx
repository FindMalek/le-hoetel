import { getDirection } from "@le-hoetel/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@le-hoetel/ui/components/card"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { getOfferPage } from "@/lib/api"
import { guestBrand } from "@/lib/branding"

export const metadata: Metadata = {
  title: "Offer",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

const DAY_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: "long", timeZone: "Africa/Tunis" }

export default async function Page({ params }: PageProps<"/o/[token]">) {
  await connection()
  const { token } = await params
  const page = await getOfferPage(token)

  if (!page) {
    const t = await getTranslations("offer")
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

  const t = await getTranslations({ locale: page.language, namespace: "offer" })
  const day = new Intl.DateTimeFormat(page.language, DAY_FORMAT)
  const usable = page.state === "ready"
  return (
    <main
      lang={page.language}
      dir={getDirection(page.language)}
      // oxlint-disable-next-line shadcn/no-inline-styles
      style={guestBrand(page.hotel)}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10"
    >
      <Card>
        <CardHeader>
          {page.hotel.logoUrl ? (
            // biome-ignore lint/performance/noImgElement: the logo is a hotel upload served by the api, not a static asset
            <img
              src={page.hotel.logoUrl}
              alt={page.hotel.displayName}
              className="mb-2 h-12 w-auto self-start object-contain"
            />
          ) : (
            <p className="font-medium text-muted-foreground text-sm">{page.hotel.displayName}</p>
          )}
          <CardTitle className="text-2xl">{page.offer.title}</CardTitle>
          {page.offer.text ? <CardDescription>{page.offer.text}</CardDescription> : null}
        </CardHeader>
        <CardContent className="grid gap-4">
          <p role="status" className={usable ? "bg-accent p-3 text-accent-foreground text-sm" : "bg-muted p-3 text-sm"}>
            {t(`state.${page.state}`)}
          </p>
          {usable ? (
            <>
              {/* biome-ignore lint/performance/noImgElement: an inline svg made by the api for this code */}
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(page.qrSvg)}`}
                alt={t("qrAlt", { code: page.code })}
                className="mx-auto aspect-square w-full max-w-64"
              />
              <p className="text-center">
                <span className="block text-muted-foreground text-sm">{t("code")}</span>
                <bdi dir="ltr" className="font-mono font-semibold text-2xl tracking-widest">
                  {page.code}
                </bdi>
              </p>
              <p className="text-center text-muted-foreground text-sm">{t("show")}</p>
            </>
          ) : null}
          <p className="text-center text-muted-foreground text-xs">
            {page.offer.validUntil
              ? t("validBetween", { from: day.format(page.offer.validFrom), until: day.format(page.offer.validUntil) })
              : t("validFrom", { from: day.format(page.offer.validFrom) })}
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
