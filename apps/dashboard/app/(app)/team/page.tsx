import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { TeamBoard } from "@/components/team-board"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  const t = await getTranslations("team")
  const [me, mine] = await Promise.all([call((api) => api.me.get()), call((api) => api.hotel.mine())])
  const canManage = mine.role !== "staff"
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <TeamBoard meId={me.id} canManage={canManage} />
      </div>
    </>
  )
}
