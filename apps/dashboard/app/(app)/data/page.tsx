import { hotelRoles } from "@ritorno/auth/access"
import { EmptyState } from "@ritorno/ui/components/empty-state"
import { LockIcon } from "lucide-react"
import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { GuestDataPanel } from "@/components/guest-data-panel"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("guestData")
  return { title: t("title") }
}

export default async function GuestDataPage() {
  await connection()
  const [t, { role }, hotel] = await Promise.all([
    getTranslations("guestData"),
    call((api) => api.hotel.mine()),
    call((api) => api.hotel.get()).catch(() => null),
  ])
  const allowed = role ? hotelRoles[role].authorize({ guest: ["export", "delete"] }).success : false
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="max-w-4xl p-4 md:p-6">
        {hotel && allowed ? (
          <GuestDataPanel hotelName={hotel.displayName} />
        ) : (
          <EmptyState icon={<LockIcon />} title={t("forbiddenTitle")} description={t("forbidden")} />
        )}
      </div>
    </>
  )
}
