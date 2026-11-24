import type { Metadata } from "next"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { GuestDataPanel } from "@/components/guest-data-panel"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Guest data" }

export default async function GuestDataPage() {
  await connection()
  const [t, hotel] = await Promise.all([getTranslations("guestData"), call((api) => api.hotel.get()).catch(() => null)])
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="max-w-2xl p-4 md:p-6">
        {hotel ? (
          <GuestDataPanel
            hotelName={hotel.displayName}
            copy={{
              forbidden: t("forbidden"),
              hotelTitle: t("hotelTitle"),
              hotelDescription: t("hotelDescription"),
              exportJson: t("exportJson"),
              exportCsv: t("exportCsv"),
              deleteAll: t("deleteAll"),
              deleteAllTitle: t("deleteAllTitle"),
              deleteAllBody: t("deleteAllBody"),
              typeName: t("typeName"),
              cancel: t("cancel"),
              confirm: t("confirm"),
              deleted: t("deleted"),
              exported: t("exported"),
              guestTitle: t("guestTitle"),
              guestDescription: t("guestDescription"),
              search: t("search"),
              noResults: t("noResults"),
              deleteGuest: t("deleteGuest"),
              deleteGuestTitle: t("deleteGuestTitle"),
              deleteGuestBody: t("deleteGuestBody"),
              error: t("error"),
            }}
          />
        ) : (
          <p className="text-muted-foreground">{t("forbidden")}</p>
        )}
      </div>
    </>
  )
}
