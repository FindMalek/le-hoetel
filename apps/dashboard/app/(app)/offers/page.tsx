import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OffersBoard, type OffersLabels } from "@/components/offers-board"
import { PageHeader } from "@/components/page-header"
import { call, getQueryClient, serverOrpc } from "@/lib/api"

export const metadata: Metadata = { title: "Offers" }

export default async function OffersPage() {
  const t = await getTranslations("offers")
  const queryClient = getQueryClient()
  const [hotel] = await Promise.all([
    call((api) => api.hotel.get()),
    queryClient.prefetchQuery(serverOrpc.offers.list.queryOptions()),
  ])
  const labels: OffersLabels = {
    add: t("add"),
    empty: t("empty"),
    emptyHint: t("emptyHint"),
    edit: t("edit"),
    remove: t("remove"),
    removeTitle: t("removeTitle"),
    removeBody: t("removeBody", { title: "{title}" }),
    cancel: t("cancel"),
    save: t("save"),
    saved: t("saved"),
    removed: t("removed"),
    formNew: t("formNew"),
    formEdit: t("formEdit"),
    formHint: t("formHint"),
    fieldTitle: t("fieldTitle"),
    fieldText: t("fieldText"),
    fieldCode: t("fieldCode"),
    fieldCodeHint: t("fieldCodeHint"),
    fieldTrigger: t("fieldTrigger"),
    fieldFrom: t("fieldFrom"),
    fieldUntil: t("fieldUntil"),
    fieldUntilHint: t("fieldUntilHint"),
    fieldMax: t("fieldMax"),
    fieldMaxHint: t("fieldMaxHint"),
    fieldActive: t("fieldActive"),
    triggerNone: t("triggerNone"),
    triggerWelcome: t("triggerWelcome"),
    triggerBirthday: t("triggerBirthday"),
    triggerManual: t("triggerManual"),
    redeemed: t("redeemed", { count: "{count}" }),
    redeemedOf: t("redeemedOf", { count: "{count}", max: "{max}" }),
    forever: t("forever"),
    until: t("until", { date: "{date}" }),
    state: {
      ready: t("state.ready"),
      inactive: t("state.inactive"),
      notStarted: t("state.notStarted"),
      expired: t("state.expired"),
      exhausted: t("state.exhausted"),
    },
    preview: {
      title: t("preview.title"),
      code: t("preview.code"),
      show: t("preview.show"),
      validFrom: t("preview.validFrom", { from: "{from}" }),
      validBetween: t("preview.validBetween", { from: "{from}", until: "{until}" }),
    },
  }
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OffersBoard hotelName={hotel.displayName} labels={labels} />
      </HydrationBoundary>
    </>
  )
}
