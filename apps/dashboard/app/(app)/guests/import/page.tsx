import { hotelRoles } from "@le-hoetel/auth/access"
import { Button } from "@le-hoetel/ui/components/button"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { GuestImport } from "@/components/guest-import"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export default async function ImportGuestsPage() {
  const [t, { role }] = await Promise.all([getTranslations("guests"), call((api) => api.hotel.mine())])
  if (!role || !hotelRoles[role].authorize({ guest: ["import"] }).success) redirect("/guests")
  const hotel = await call((api) => api.hotel.get())
  return (
    <>
      <PageHeader title={t("import.title")} description={t("import.description")} />
      <div className="grid gap-4 p-4 md:p-6">
        <Button variant="ghost" className="h-11 w-fit" render={<Link href="/guests" />} nativeButton={false}>
          <ArrowLeftIcon className="rtl:rotate-180" />
          {t("back")}
        </Button>
        <GuestImport defaultLanguage={hotel.defaultLanguage} />
      </div>
    </>
  )
}
