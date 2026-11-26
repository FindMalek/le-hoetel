import { hotelRoles } from "@ritorno/auth/access"
import { isNotFound } from "@ritorno/orpc/errors"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { GuestEditForm } from "@/components/guest-edit-form"
import { GuestsBreadcrumb } from "@/components/guests-breadcrumb"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export default async function EditGuestPage({ params }: PageProps<"/guests/[id]/edit">) {
  const { id } = await params
  const [t, { role }] = await Promise.all([getTranslations("guests.edit"), call((api) => api.hotel.mine())])
  if (!role || !hotelRoles[role].authorize({ guest: ["update"] }).success) redirect(`/guests/${id}`)
  const guest = await call((api) => api.guests.get({ id })).catch((error) => {
    if (isNotFound(error)) return null
    throw error
  })
  if (!guest) notFound()
  return (
    <>
      <PageHeader
        breadcrumb={<GuestsBreadcrumb current={guest.name} href={`/guests/${guest.id}`} page={t("title")} />}
        title={t("title")}
        description={t("description")}
      />
      <div className="p-4 md:p-6">
        <GuestEditForm guest={guest} />
      </div>
    </>
  )
}
