import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { OfferForm } from "@/components/offer-form"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"
import { getOfferPreviewCopies } from "@/lib/preview-copy"

export const metadata: Metadata = { title: "New offer" }

export default async function NewOfferPage() {
  const t = await getTranslations("offers")
  const [hotel, mine] = await Promise.all([call((api) => api.hotel.get()), call((api) => api.hotel.mine())])
  if (mine.role === "staff") redirect("/offers")
  return (
    <>
      <PageHeader title={t("formNew")} description={t("formHint")} />
      <div className="p-4 md:p-6">
        <OfferForm offer={null} hotel={hotel} copies={await getOfferPreviewCopies()} />
      </div>
    </>
  )
}
