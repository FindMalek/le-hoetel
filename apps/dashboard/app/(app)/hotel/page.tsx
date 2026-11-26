import { isForbidden } from "@ritorno/orpc/errors"
import { PageState } from "@ritorno/ui/components/page-state"
import { HotelIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HotelSettingsForm } from "@/components/hotel-settings-form"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"
import { getPreviewCopies } from "@/lib/preview-copy"

export const metadata: Metadata = { title: "Hotel" }

export default async function HotelPage() {
  const t = await getTranslations("hotelSettings")
  const [hotel, mine, alerts] = await Promise.all([
    call((api) => api.hotel.get()).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
    call((api) => api.hotel.mine()),
    call((api) => api.hotel.alerts.status()).catch(() => null),
  ])
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        {hotel ? (
          <HotelSettingsForm
            hotel={hotel}
            copies={await getPreviewCopies()}
            alerts={alerts}
            readOnly={mine.role === "staff"}
          />
        ) : (
          <PageState kind="empty" icon={<HotelIcon />} title={t("noHotel")} description={t("noHotelHint")} />
        )}
      </div>
    </>
  )
}
