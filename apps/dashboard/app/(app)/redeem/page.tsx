import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@/components/page-header"
import { type RedeemLabels, RedeemScreen } from "@/components/redeem-screen"
import { getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Redeem" }

export default async function RedeemPage() {
  const t = await getTranslations("redeem")
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(serverOrpc.offers.redemptionStats.queryOptions())
  const labels: RedeemLabels = {
    scan: t("scan"),
    stopScan: t("stopScan"),
    scanLabel: t("scanLabel"),
    noCamera: t("noCamera"),
    cameraFailed: t("cameraFailed"),
    typeCode: t("typeCode"),
    codePlaceholder: t("codePlaceholder"),
    check: t("check"),
    redeem: t("redeem"),
    redeeming: t("redeeming"),
    next: t("next"),
    guest: t("guest"),
    validUntil: t("validUntil"),
    noEnd: t("noEnd"),
    redeemedAt: t("redeemedAt"),
    redeemedBy: t("redeemedBy"),
    justNow: t("justNow"),
    today: t("today"),
    week: t("week"),
    total: t("total"),
    recent: t("recent"),
    noRecent: t("noRecent"),
    status: {
      ready: t("status.ready"),
      redeemed: t("status.redeemed"),
      expired: t("status.expired"),
      notStarted: t("status.notStarted"),
      inactive: t("status.inactive"),
      exhausted: t("status.exhausted"),
      wrongHotel: t("status.wrongHotel"),
      unknown: t("status.unknown"),
    },
  }
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <RedeemScreen labels={labels} />
      </HydrationBoundary>
    </>
  )
}
