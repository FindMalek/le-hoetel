import { Button } from "@ritorno/ui/components/button"
import { InlineAlert } from "@ritorno/ui/components/inline-alert"
import { PageState } from "@ritorno/ui/components/page-state"
import { UsersIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { HotelPeople } from "@/components/hotel-people"
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
          <ViewedTeam hotelId={hotel.id} />
        ) : (
          <PageState kind="empty" icon={<UsersIcon />} title={tHotel("noHotel")} description={tHotel("noHotelHint")} />
        )}
      </div>
    </>
  )
}

/** The app admin acting as a hotel they do not belong to: its people to read, changes stay with its members. */
async function ViewedTeam({ hotelId }: { hotelId: string }) {
  const [t, hotel] = await Promise.all([getTranslations("team"), call((api) => api.admin.hotels.get({ id: hotelId }))])
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <InlineAlert
        tone="info"
        title={t("notMember", { hotel: hotel.displayName })}
        action={
          <Button size="sm" variant="outline" render={<Link href={`/admin/hotels/${hotelId}`} />} nativeButton={false}>
            {t("notMemberAction")}
          </Button>
        }
      >
        {t("notMemberHint")}
      </InlineAlert>
      <HotelPeople hotel={hotel} />
    </div>
  )
}
