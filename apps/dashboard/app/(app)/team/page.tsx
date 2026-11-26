import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { TeamBoard } from "@/components/team-board"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  const [t, tHotel] = await Promise.all([getTranslations("team"), getTranslations("hotelSettings")])
  const [me, mine, hotel] = await Promise.all([
    call((api) => api.me.get()),
    call((api) => api.hotel.mine()),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  const canManage = mine.role !== "staff"
  // The invite and member calls need a membership, which the app admin acting as a hotel usually lacks.
  const member = mine.hotels.some(({ id }) => id === hotel?.id)
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        {hotel && member ? (
          <TeamBoard hotelId={hotel.id} meId={me.id} canManage={canManage} timeZone={hotel.timezone} />
        ) : hotel ? (
          <PageState
            kind="forbidden"
            icon={<UsersIcon />}
            title={t("notMember", { hotel: hotel.displayName })}
            description={t("notMemberHint")}
            action={
              <Button render={<Link href={`/admin/hotels/${hotel.id}`} />} nativeButton={false}>
                {t("notMemberAction")}
              </Button>
            }
          />
        ) : (
          <PageState kind="empty" icon={<UsersIcon />} title={tHotel("noHotel")} description={tHotel("noHotelHint")} />
        )}
      </div>
    </>
  )
}
