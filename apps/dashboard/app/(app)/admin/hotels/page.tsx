import { Badge } from "@le-hoetel/ui/components/badge"
import { Card, CardContent } from "@le-hoetel/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@le-hoetel/ui/components/table"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { HotelCreateForm } from "@/components/hotel-create-form"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export const metadata: Metadata = { title: "Hotels" }

export default async function AdminHotelsPage() {
  const [t, tBrand, hotels] = await Promise.all([
    getTranslations("adminHotels"),
    getTranslations("hotelSettings"),
    call((api) => api.admin.hotels.list()),
  ])
  const health = {
    healthy: t("health.healthy"),
    quiet: t("health.quiet"),
    "no-guests": t("health.no-guests"),
    "no-owner": t("health.no-owner"),
    suspended: t("health.suspended"),
  }
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid content-start gap-4 p-4 md:p-6 lg:grid-cols-3">
        <HotelCreateForm
          labels={{
            title: t("createTitle"),
            name: t("name"),
            slug: t("slug"),
            ownerEmail: t("ownerEmail"),
            ownerHint: t("ownerHint"),
            primaryColor: t("primaryColor"),
            accentColor: t("accentColor"),
            language: t("language"),
            submit: t("submit"),
            created: t("created"),
            sample: tBrand("sample"),
            contrastLight: tBrand("contrastLight"),
            contrastDark: tBrand("contrastDark"),
          }}
        />
        <Card className="lg:col-span-2">
          <CardContent>
            {hotels.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.hotel")}</TableHead>
                    <TableHead className="text-end">{t("columns.guests")}</TableHead>
                    <TableHead className="text-end">{t("columns.owners")}</TableHead>
                    <TableHead>{t("columns.health")}</TableHead>
                    <TableHead className="text-end">{t("columns.created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.map((hotel) => (
                    <TableRow key={hotel.id}>
                      <TableCell className="font-medium">
                        {hotel.displayName}
                        <span className="block text-muted-foreground text-xs">{hotel.slug}</span>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">{hotel.guestCount}</TableCell>
                      <TableCell className="text-end tabular-nums">{hotel.ownerCount}</TableCell>
                      <TableCell>
                        <Badge variant={hotel.health === "healthy" ? "default" : "outline"}>
                          {health[hotel.health]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        <LocalDate value={hotel.createdAt} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
