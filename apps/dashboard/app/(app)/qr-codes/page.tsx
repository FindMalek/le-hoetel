import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { QrCodesBoard, type QrCodesLabels } from "@/components/qr-codes-board"
import { getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "QR codes" }

const LABELS = [
  "newTitle",
  "newDescription",
  "where",
  "rooms",
  "tables",
  "desk",
  "room",
  "table",
  "roomHint",
  "tableHint",
  "deskHint",
  "spots",
  "spotsHint",
  "generate",
  "guestsSoFar",
  "alt",
  "tableTitle",
  "tableDescription",
  "empty",
  "colWhere",
  "colSpot",
  "colGuests",
] as const

export default async function QrCodesPage() {
  const t = await getTranslations("qrCodes")
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(serverOrpc.hotel.captureStats.queryOptions())
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QrCodesBoard labels={Object.fromEntries(LABELS.map((key) => [key, t(key)])) as QrCodesLabels} />
      </HydrationBoundary>
    </>
  )
}
