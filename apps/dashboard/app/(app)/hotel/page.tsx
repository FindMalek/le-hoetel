import { isForbidden } from "@le-hoetel/orpc/errors"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
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
  const [hotel, mine] = await Promise.all([
    call((api) => api.hotel.get()).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
    call((api) => api.hotel.mine()),
  ])
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        {hotel ? (
          <HotelSettingsForm hotel={hotel} copies={await getPreviewCopies()} readOnly={mine.role === "staff"} />
        ) : (
          <EmptyState icon={<HotelIcon />} title={t("noHotel")} description={t("noHotelHint")} />
        )}
      </div>
    </>
  )
}
