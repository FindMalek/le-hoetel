import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { QrCodesBoard } from "@/components/qr-codes-board"
import { getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "QR codes" }

export default async function QrCodesPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(serverOrpc.hotel.captureStats.queryOptions())
  return (
    <>
      <PageHeader
        title="QR codes"
        description="Print one code per room, table or front desk and see which one captures guests."
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QrCodesBoard />
      </HydrationBoundary>
    </>
  )
}
