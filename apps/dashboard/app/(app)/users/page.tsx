import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AdminUsersBoard } from "@/components/admin-users-board"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Users" }

export default async function UsersPage() {
  const [t, { total, users }] = await Promise.all([getTranslations("adminUsers"), call((api) => api.admin.users())])
  return (
    <>
      <PageHeader title={t("title")} description={t("description", { count: total })} />
      <div className="p-4 md:p-6">
        <AdminUsersBoard users={users} />
      </div>
    </>
  )
}
