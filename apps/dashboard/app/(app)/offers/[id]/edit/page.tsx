import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { OfferForm } from "@/components/offer-form"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"
import { getOfferPreviewCopies } from "@/lib/preview-copy"

export const metadata: Metadata = { title: "Edit offer" }

export default async function EditOfferPage({ params }: PageProps<"/offers/[id]/edit">) {
  const { id } = await params
  const t = await getTranslations("offers")
  const [hotel, mine, offers] = await Promise.all([
    call((api) => api.hotel.get()),
    call((api) => api.hotel.mine()),
    call((api) => api.offers.list()),
  ])
  if (mine.role === "staff") redirect("/offers")
  const offer = offers.find((item) => item.id === id)
  if (!offer) notFound()
  return (
    <>
      <PageHeader title={t("formEdit")} description={t("formHint")} />
      <div className="p-4 md:p-6">
        <OfferForm offer={offer} hotel={hotel} copies={await getOfferPreviewCopies()} />
      </div>
    </>
  )
}
