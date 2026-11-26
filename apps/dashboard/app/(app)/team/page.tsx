import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { TeamBoard } from "@/components/team-board"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  const t = await getTranslations("team")
  const [me, mine, hotel] = await Promise.all([
    call((api) => api.me.get()),
    call((api) => api.hotel.mine()),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  const canManage = mine.role !== "staff"
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <TeamBoard meId={me.id} canManage={canManage} timeZone={hotel?.timezone} />
      </div>
    </>
  )
}
