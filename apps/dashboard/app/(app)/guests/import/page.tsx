import { hotelRoles } from "@le-hoetel/auth/access"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { GuestImport } from "@/components/guest-import"
import { GuestsBreadcrumb } from "@/components/guests-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export default async function ImportGuestsPage() {
  const [t, { role }] = await Promise.all([getTranslations("guests"), call((api) => api.hotel.mine())])
  if (!role || !hotelRoles[role].authorize({ guest: ["import"] }).success) redirect("/guests")
  const hotel = await call((api) => api.hotel.get())
  return (
    <>
      <PageHeader
        breadcrumb={<GuestsBreadcrumb current={t("import.title")} />}
        title={t("import.title")}
        description={t("import.description")}
      />
      <div className="p-4 md:p-6">
        <GuestImport defaultLanguage={hotel.defaultLanguage} />
      </div>
    </>
  )
}
