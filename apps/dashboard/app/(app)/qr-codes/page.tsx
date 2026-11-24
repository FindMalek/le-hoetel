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
  await queryClient.prefetchQuery(serverOrpc.hotel.captureStats.queryOptions())
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QrCodesBoard
          labels={{
            newTitle: t("newTitle"),
            newDescription: t("newDescription"),
            where: t("where"),
            rooms: t("rooms"),
            tables: t("tables"),
            desk: t("desk"),
            room: t("room"),
            table: t("table"),
            roomHint: t("roomHint"),
            tableHint: t("tableHint"),
            deskHint: t("deskHint"),
            spots: t("spots"),
            spotsHint: t("spotsHint"),
            generate: t("generate"),
            guestsSoFar: t("guestsSoFar"),
            alt: t("alt"),
            tableTitle: t("tableTitle"),
            tableDescription: t("tableDescription"),
            empty: t("empty"),
            colWhere: t("colWhere"),
            colSpot: t("colSpot"),
            colGuests: t("colGuests"),
          }}
        />
      </HydrationBoundary>
    </>
  )
}
