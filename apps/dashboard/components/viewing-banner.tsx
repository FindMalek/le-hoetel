import { Button } from "@ritorno/ui/components/button"
import { EyeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { leaveHotel } from "@/app/(app)/admin/hotels/actions"
import { call } from "@/lib/api"
import { viewedHotelId } from "@/lib/view-hotel"

/** Shown to the app admin while they act as a hotel, so they never forget whose data is on screen. */
export async function ViewingBanner() {
  const hotelId = await viewedHotelId()
  if (!hotelId) return null
  const [t, hotel] = await Promise.all([
    getTranslations("adminHotel"),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  if (!hotel) return null
  return (
    <div className="sticky top-14 z-20 flex items-center gap-3 border-b bg-secondary px-4 py-2 text-secondary-foreground text-sm md:px-6">
      <EyeIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate">{t("viewingAs", { hotel: hotel.displayName })}</p>
      <form action={leaveHotel.bind(null, hotelId)}>
        <Button type="submit" size="sm" variant="outline">
          {t("leave")}
        </Button>
      </form>
    </div>
  )
}
