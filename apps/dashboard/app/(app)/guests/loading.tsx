import { ListSkeleton } from "@ritorno/ui/components/loading-state"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"

export default async function Loading() {
  const t = await getTranslations("guests")
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <ListSkeleton label={t("loading")} rows={6} />
      </div>
    </>
  )
}
