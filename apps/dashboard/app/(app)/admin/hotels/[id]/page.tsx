import { isNotFound } from "@ritorno/orpc/errors"
import { Badge } from "@ritorno/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@ritorno/ui/components/breadcrumb"
import { Button } from "@ritorno/ui/components/button"
import { FormSection } from "@ritorno/ui/components/form-section"
import { Section } from "@ritorno/ui/components/section"
import { StatCard } from "@ritorno/ui/components/stat-card"
import { ExternalLinkIcon, EyeIcon, QrCodeIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { AdminCaptureLink } from "@/components/admin-capture-link"
import { AdminBrandingForm, AdminDangerZone, AdminPlanForm } from "@/components/admin-hotel-forms"
import { AdminTopUp } from "@/components/admin-top-up"
import { HotelAvatar } from "@/components/hotel-avatar"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
import { relativeTime } from "@/components/relative-day"
import { consentRate, HEALTH_TONE } from "@/lib/admin"
import { call } from "@/lib/api"
import { openAsHotel } from "../actions"

export const metadata: Metadata = { title: "Hotel" }

export default async function AdminHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [t, tList, locale, hotel, balance] = await Promise.all([
    getTranslations("adminHotel"),
    getTranslations("adminHotels"),
    getLocale(),
    call((api) => api.admin.hotels.get({ id })).catch((error) => {
      if (isNotFound(error)) notFound()
      throw error
    }),
    call((api) => api.admin.hotels.balance.get({ id })),
  ])
  const now = new Date()
  const rate = consentRate(hotel)
  const publicUrl = hotel.capturePageUrl.split("?")[0] ?? hotel.capturePageUrl

  return (
    <>
      <div className="px-4 pt-4 md:px-6 md:pt-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/admin/hotels" />}>{t("breadcrumb")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{hotel.displayName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <PageHeader
        title={hotel.displayName}
        description={`${hotel.slug} · ${t(`statuses.${hotel.status}`)}`}
        actions={
          <>
            <Button
              variant="outline"
              render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
            >
              <ExternalLinkIcon data-icon="inline-start" />
              {t("capturePage")}
            </Button>
            <form action={openAsHotel.bind(null, hotel.id, "/")}>
              <Button type="submit" className="w-full">
                <EyeIcon data-icon="inline-start" />
                {t("openAs")}
              </Button>
            </form>
          </>
        }
      />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        <Section
          title={t("overview")}
          actions={<Badge variant={HEALTH_TONE[hotel.health]}>{tList(`health.${hotel.health}`)}</Badge>}
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t("stats.guests")} value={hotel.guestCount} />
            <StatCard
              label={t("stats.consent")}
              value={rate === null ? "–" : `${rate}%`}
              hint={t("stats.consentHint", { count: hotel.consentedCount })}
            />
            <StatCard label={t("stats.messages")} value={hotel.messageCount} />
            <StatCard
              label={t("stats.lastCapture")}
              value={
                <span className="text-xl md:text-2xl">
                  {hotel.lastGuestAt ? relativeTime(hotel.lastGuestAt, now, locale) : "–"}
                </span>
              }
              hint={hotel.lastGuestAt ? undefined : tList("noCapture")}
            />
          </div>
          <p className="flex items-center gap-3 text-muted-foreground text-sm">
            <HotelAvatar name={hotel.displayName} logoKey={hotel.logoKey} className="size-8" />
            <span>
              {t("createdOn")} <LocalDate value={hotel.createdAt} />
            </span>
          </p>
        </Section>

        <div className="flex flex-col">
          <FormSection title={t("branding")} description={t("brandingHint")}>
            <AdminBrandingForm hotel={hotel} />
            <form action={openAsHotel.bind(null, hotel.id, "/hotel")}>
              <p className="mb-2 text-muted-foreground text-sm">{t("logoHint")}</p>
              <Button type="submit" variant="outline">
                {t("logoOpen")}
              </Button>
            </form>
          </FormSection>

          <FormSection title={t("people")} description={t("peopleHint")}>
            {hotel.members.length === 0 && hotel.invitations.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noPeople")}</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {hotel.members.map((person) => (
                  <li key={person.userId} className="flex items-center justify-between gap-3 p-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-sm">{person.name}</span>
                      <span className="truncate text-muted-foreground text-xs" dir="ltr">
                        {person.email}
                      </span>
                    </span>
                    <Badge variant="secondary">{person.role.split(",")[0]}</Badge>
                  </li>
                ))}
                {hotel.invitations.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 p-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm" dir="ltr">
                        {invite.email}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {t("inviteExpires")} <LocalDate value={invite.expiresAt} />
                      </span>
                    </span>
                    <Badge variant="outline">{t("invited")}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>

          <FormSection title={t("pilotPlan")} description={t("pilotPlanHint")}>
            <AdminPlanForm hotel={hotel} />
          </FormSection>

          <FormSection title={t("capture")} description={t("captureHint")}>
            <AdminCaptureLink url={publicUrl} />
            <form action={openAsHotel.bind(null, hotel.id, "/qr-codes")}>
              <Button type="submit" variant="outline">
                <QrCodeIcon data-icon="inline-start" />
                {t("qrCodes")}
              </Button>
            </form>
          </FormSection>

          <FormSection title={t("balance")} description={t("balanceHint")}>
            <AdminTopUp hotelId={hotel.id} balanceMillimes={balance.balanceMillimes} />
          </FormSection>

          <FormSection title={t("danger")} description={t("dangerHint")}>
            <AdminDangerZone hotel={{ ...hotel, hasPilotEnd: Boolean(hotel.pilotEndsAt) }} />
          </FormSection>
        </div>
      </div>
    </>
  )
}
