import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { QrCodesBoard } from "@/components/qr-codes-board"
import { getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "QR codes" }

export default async function QrCodesPage() {
  const t = await getTranslations("qrCodes")
  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(serverOrpc.hotel.captureStats.queryOptions()),
    queryClient.prefetchQuery(serverOrpc.hotel.spots.list.queryOptions()),
  ])
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <QrCodesBoard />
        </HydrationBoundary>
      </div>
    </>
  )
}
