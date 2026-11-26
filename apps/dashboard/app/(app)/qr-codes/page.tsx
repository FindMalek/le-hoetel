import { HOTEL_LANGUAGES, type HotelLanguage } from "@ritorno/common/hotel"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import type { KitWords } from "@/components/qr/art"
import { QrStudio } from "@/components/qr/studio"
import { call, getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "QR codes" }

/** The words printed on the paper: its language is picked on the page, so all three go to the browser. */
async function kitWords(language: HotelLanguage, hotel: string): Promise<KitWords> {
  const t = await getTranslations({ locale: language, namespace: "qrKit" })
  return {
    headlines: { room: t("headlineRoom"), table: t("headlineTable"), desk: t("headlineDesk") },
    scan: t("scan"),
    noApp: t("noApp"),
    perkTitle: t("perkTitle"),
    perkBody: t("perkBody", { hotel }),
    alt: t("alt"),
    sheetScan: t("sheetScan"),
  }
}

export default async function QrCodesPage() {
  const t = await getTranslations("qrCodes")
  const queryClient = getQueryClient()
  // `fetchQuery`, not `prefetchQuery`: a swallowed failure leaves the suspense query loading forever.
  const [hotel] = await Promise.all([
    call(() => queryClient.fetchQuery(serverOrpc.hotel.get.queryOptions())),
    call(() => queryClient.fetchQuery(serverOrpc.hotel.spots.list.queryOptions())),
    call(() => queryClient.fetchQuery(serverOrpc.hotel.welcomeOffer.queryOptions())),
    call(() => queryClient.fetchQuery(serverOrpc.hotel.captureStats.queryOptions())),
  ])
  const words = Object.fromEntries(
    await Promise.all(HOTEL_LANGUAGES.map(async (item) => [item, await kitWords(item, hotel.displayName)])),
  ) as Record<HotelLanguage, KitWords>
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="p-4 md:p-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <QrStudio words={words} />
        </HydrationBoundary>
      </div>
    </>
  )
}
