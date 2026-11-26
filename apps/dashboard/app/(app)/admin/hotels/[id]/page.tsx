import { isNotFound } from "@ritorno/orpc/errors"
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
import { StatusBadge } from "@ritorno/ui/components/status-badge"
import { formatDate } from "@ritorno/ui/lib/date"
import { formatNumber } from "@ritorno/ui/lib/number"
import { ExternalLinkIcon, EyeIcon, QrCodeIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { InvoiceForm } from "@/components/admin-billing-forms"
import { AdminCaptureLink } from "@/components/admin-capture-link"
import { AdminBrandingForm, AdminDangerZone, AdminPlanForm, AdminRename } from "@/components/admin-hotel-forms"
import { InvoiceExport, InvoiceList } from "@/components/admin-invoices"
import { AdminTopUp } from "@/components/admin-top-up"
import { HotelAvatar } from "@/components/hotel-avatar"
import { HotelPeople } from "@/components/hotel-people"
import { PageHeader } from "@/components/page-header"
import { relativeTime } from "@/components/relative-day"
import { consentRate, HEALTH_TONE, STATUS_TONE } from "@/lib/admin"
import { call } from "@/lib/api"
import { openAsHotel } from "../actions"

export const metadata: Metadata = { title: "Hotel" }

// i18n-used: adminBilling.hotelHint
export default async function AdminHotelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [t, tList, tBilling, locale, hotel, balance, plans, invoices] = await Promise.all([
    getTranslations("adminHotel"),
    getTranslations("adminHotels"),
    getTranslations("adminBilling"),
    getLocale(),
    call((api) => api.admin.hotels.get({ id })).catch((error) => {
      if (isNotFound(error)) notFound()
      throw error
    }),
    call((api) => api.admin.hotels.balance.get({ id })),
    call((api) => api.admin.billing.plans()),
    call((api) => api.admin.billing.invoices({ hotelId: id })),
  ])
  const now = new Date()
  const rate = consentRate(hotel)
  const publicUrl = hotel.capturePageUrl.split("?")[0] ?? hotel.capturePageUrl
  const date = (value: Date) => formatDate(value, locale, hotel.timezone)
  const count = (value: number) => formatNumber(value, locale)

  return (
    <>
      <PageHeader
        breadcrumb={
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
        }
        title={hotel.displayName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <bdi dir="ltr">{hotel.slug}</bdi>
            <StatusBadge tone={STATUS_TONE[hotel.status]}>{t(`statuses.${hotel.status}`)}</StatusBadge>
            <StatusBadge tone={HEALTH_TONE[hotel.health]}>{tList(`health.${hotel.health}`)}</StatusBadge>
          </span>
        }
        secondaryActions={
          <Button
            variant="outline"
            render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            {t("capturePage")}
          </Button>
        }
        action={
          <form action={openAsHotel.bind(null, hotel.id, "/")}>
            <Button type="submit" className="w-full">
              <EyeIcon data-icon="inline-start" />
              {t("openAs")}
            </Button>
          </form>
        }
      />
      <div className="flex flex-col gap-10 p-4 md:p-6">
        <Section title={t("overview")}>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatCard label={t("stats.guests")} value={count(hotel.guestCount)} />
            <StatCard
              label={t("stats.consent")}
              value={rate === null ? "–" : `${rate}%`}
              hint={t("stats.consentHint", { count: hotel.consentedCount })}
            />
            <StatCard label={t("stats.messages")} value={count(hotel.messageCount)} />
            <StatCard
              label={t("stats.lastCapture")}
              value={
                <span className="text-h3">
                  {hotel.lastGuestAt ? relativeTime(hotel.lastGuestAt, now, locale) : "–"}
                </span>
              }
              hint={hotel.lastGuestAt ? undefined : tList("noCapture")}
            />
          </div>
          <p className="flex items-center gap-3 text-muted-foreground text-small">
            <HotelAvatar name={hotel.displayName} logoKey={hotel.logoKey} className="size-8" />
            <span>{t("createdOn", { date: date(hotel.createdAt) })}</span>
          </p>
        </Section>

        <div className="flex flex-col">
          <FormSection title={t("pilotPlan")} description={t("pilotPlanHint")}>
            <AdminPlanForm hotel={hotel} plans={plans} />
          </FormSection>

          <FormSection title={tBilling("invoices")} description={tBilling("hotelHint")}>
            <InvoiceForm
              hotelId={hotel.id}
              defaultMillimes={plans.find((plan) => plan.plan === hotel.plan)?.monthlyMillimes ?? null}
            />
            <InvoiceList invoices={invoices} />
            {invoices.length ? <InvoiceExport hotelId={hotel.id} disabled={false} /> : null}
          </FormSection>

          <FormSection title={t("rename")} description={t("renameHint")}>
            <AdminRename hotel={hotel} />
          </FormSection>

          <FormSection title={t("branding")} description={t("brandingHint")}>
            <AdminBrandingForm hotel={hotel} />
            <form action={openAsHotel.bind(null, hotel.id, "/hotel")}>
              <p className="mb-2 text-muted-foreground text-small">{t("logoHint")}</p>
              <Button type="submit" variant="outline">
                {t("logoOpen")}
              </Button>
            </form>
          </FormSection>

          <FormSection title={t("people")} description={t("peopleHint")}>
            <HotelPeople hotel={hotel} />
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
