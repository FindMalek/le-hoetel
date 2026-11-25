import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { GuestQuickAdd } from "@/components/guest-quick-add"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"
import { GuestsBreadcrumb } from "@/components/guests-breadcrumb"

export default async function NewGuestPage() {
  const [t, { activeId }] = await Promise.all([getTranslations("guests"), call((api) => api.hotel.mine())])
  if (!activeId) redirect("/guests")
  const hotel = await call((api) => api.hotel.get())
  return (
    <>
      <PageHeader breadcrumb={<GuestsBreadcrumb current={t("add.title")} />} title={t("add.title")} description={t("add.description")} />
      <div className="p-4 md:p-6">
        <GuestQuickAdd defaultLanguage={hotel.defaultLanguage} />
      </div>
    </>
  )
}
