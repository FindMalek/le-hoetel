import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AdminUsersBoard } from "@/components/admin-users-board"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Users" }

export default async function UsersPage() {
  const [t, { total, users }, me] = await Promise.all([
    getTranslations("adminUsers"),
    call((api) => api.admin.users()),
    call((api) => api.me.get()),
  ])
  return (
    <>
      <PageHeader title={t("title")} description={t("description", { count: total })} />
      <div className="p-4 md:p-6">
        <AdminUsersBoard users={users} meId={me.id} />
      </div>
    </>
  )
}
