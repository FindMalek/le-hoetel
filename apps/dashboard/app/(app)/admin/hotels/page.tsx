import { Button } from "@ritorno/ui/components/button"
import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { AdminHotelsBoard } from "@/components/admin-hotels-board"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Hotels" }

export default async function AdminHotelsPage() {
  const [t, hotels] = await Promise.all([getTranslations("adminHotels"), call((api) => api.admin.hotels.list())])
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button render={<Link href="/admin/hotels/new" />} nativeButton={false}>
            <PlusIcon data-icon="inline-start" />
            {t("new")}
          </Button>
        }
      />
      <div className="p-4 md:p-6">
        <AdminHotelsBoard hotels={hotels} now={new Date()} />
      </div>
    </>
  )
}
