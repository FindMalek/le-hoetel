import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AdminHotelWizard } from "@/components/admin-hotel-wizard"
import { PageHeader } from "@/components/page-header"

export const metadata: Metadata = { title: "New hotel" }

export default async function NewHotelPage() {
  const t = await getTranslations("adminWizard")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <AdminHotelWizard />
      </div>
    </>
  )
}
