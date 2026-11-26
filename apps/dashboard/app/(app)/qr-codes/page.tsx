import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { QrCodesBoard } from "@/components/qr-codes-board"
import { call, getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "QR codes" }

export default async function QrCodesPage() {
  const t = await getTranslations("qrCodes")
  const queryClient = getQueryClient()
  // `fetchQuery`, not `prefetchQuery`: a swallowed failure leaves the suspense query loading forever.
  await Promise.all([
    call(() => queryClient.fetchQuery(serverOrpc.hotel.captureStats.queryOptions())),
    call(() => queryClient.fetchQuery(serverOrpc.hotel.spots.list.queryOptions())),
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
