import { isForbidden } from "@le-hoetel/orpc/errors"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HotelLogo } from "@/components/hotel-logo"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Hotel" }

export default async function HotelPage() {
  const t = await getTranslations("hotelSettings")
  const hotel = await call((api) => api.hotel.get()).catch((error) => {
    if (isForbidden(error)) return null
    throw error
  })
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="max-w-xl p-4 md:p-6">
        {hotel ? (
          <HotelLogo
            name={hotel.displayName}
            logoKey={hotel.logoKey}
            labels={{
              logo: t("logo"),
              hint: t("logoHint"),
              upload: t("upload"),
              remove: t("remove"),
              saved: t("saved"),
              removed: t("removed"),
              invalidFile: t("invalidFile"),
            }}
          />
        ) : (
          <p className="text-muted-foreground text-sm">{t("noHotel")}</p>
        )}
      </div>
    </>
  )
}
