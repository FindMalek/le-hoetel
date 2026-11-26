import { ListSkeleton } from "@ritorno/ui/components/loading-state"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"

export default async function Loading() {
  const [t, tInbox] = await Promise.all([getTranslations("whatsappScans"), getTranslations("inbox")])
  return (
    <>
      <PageHeader title={tInbox("title")} />
      <div className="p-4 md:p-6">
        <ListSkeleton label={t("loading")} rows={5} />
      </div>
    </>
  )
}
