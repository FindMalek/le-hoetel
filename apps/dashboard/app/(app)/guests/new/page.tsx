import { Button } from "@le-hoetel/ui/components/button"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { GuestQuickAdd } from "@/components/guest-quick-add"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export default async function NewGuestPage() {
  const [t, { activeId }] = await Promise.all([getTranslations("guests"), call((api) => api.hotel.mine())])
  if (!activeId) redirect("/guests")
  const hotel = await call((api) => api.hotel.get())
  return (
    <>
      <PageHeader title={t("add.title")} description={t("add.description")} />
      <div className="grid gap-4 p-4 md:p-6">
        <Button variant="ghost" className="h-11 w-fit" render={<Link href="/guests" />} nativeButton={false}>
          <ArrowLeftIcon className="rtl:rotate-180" />
          {t("back")}
        </Button>
        <GuestQuickAdd defaultLanguage={hotel.defaultLanguage} />
      </div>
    </>
  )
}
