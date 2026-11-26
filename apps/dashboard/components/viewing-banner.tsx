import { Button } from "@ritorno/ui/components/button"
import { EyeIcon } from "lucide-react"
import { getTranslations } from "next-intl/server"
import { leaveHotel } from "@/app/(app)/admin/hotels/actions"

/**
 * Shown to the app admin while they act as a hotel, so they never forget whose data is on screen. It sits in the
 * sticky header with the top bar, and `data-viewing-banner` grows `--app-header` so sticky table headers clear it.
 */
export async function ViewingBanner({ hotelId, hotelName }: { hotelId: string; hotelName: string }) {
  const t = await getTranslations("adminHotel")
  return (
    <div
      data-viewing-banner
      className="flex h-12 items-center gap-3 border-t bg-secondary px-4 text-secondary-foreground text-sm md:px-6"
    >
      <EyeIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 truncate">{t("viewingAs", { hotel: hotelName })}</p>
      <form action={leaveHotel.bind(null, hotelId)}>
        <Button type="submit" size="sm" variant="outline">
          {t("leave")}
        </Button>
      </form>
    </div>
  )
}
