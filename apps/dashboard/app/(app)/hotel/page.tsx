import { isForbidden } from "@ritorno/orpc/errors"
import { PageState } from "@ritorno/ui/components/page-state"
import { HotelIcon } from "lucide-react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HotelSettingsForm } from "@/components/hotel-settings-form"
import { LinkedHotel } from "@/components/linked-hotel"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"
import { getPreviewCopies } from "@/lib/preview-copy"

export const metadata: Metadata = { title: "Hotel" }

export default async function HotelPage({ searchParams }: PageProps<"/hotel">) {
  const { hotel: linked } = await searchParams
  const t = await getTranslations("hotelSettings")
  const [hotel, mine] = await Promise.all([
    call((api) => api.hotel.get()).catch((error) => {
      if (isForbidden(error)) return null
      throw error
    }),
    call((api) => api.hotel.mine()),
  ])
  // Emails link to `?hotel=<id>`: never show another hotel's settings under such a link.
  const elsewhere = typeof linked === "string" && linked !== hotel?.id
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        {elsewhere ? (
          <LinkedHotel target={mine.hotels.find(({ id }) => id === linked) ?? null} current={hotel?.displayName} />
        ) : hotel ? (
          <HotelSettingsForm hotel={hotel} copies={await getPreviewCopies()} readOnly={mine.role === "staff"} />
        ) : (
          <PageState kind="empty" icon={<HotelIcon />} title={t("noHotel")} description={t("noHotelHint")} />
        )}
      </div>
    </>
  )
}
