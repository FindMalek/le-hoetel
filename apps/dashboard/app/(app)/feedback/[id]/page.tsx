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
import { Section } from "@ritorno/ui/components/section"
import { formatDate } from "@ritorno/ui/lib/date"
import { MailIcon, PhoneIcon, UserRoundIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { CaseStatusBadge, ScoreBadge } from "@/components/feedback-case-badges"
import { FeedbackCaseForm } from "@/components/feedback-case-form"
import { GiveOffer } from "@/components/give-offer"
import { Phone } from "@/components/guest-list"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav")
  return { title: t("unhappyGuests") }
}

export default async function FeedbackCasePage({ params }: PageProps<"/feedback/[id]">) {
  const { id } = await params
  const [t, tNav, tDetail, locale] = await Promise.all([
    getTranslations("feedbackCases"),
    getTranslations("nav"),
    getTranslations("guests.detail"),
    getLocale(),
  ])
  // A bad link, a deleted guest or another hotel's case: all read as not found.
  const item = await call((api) => api.feedbackCases.get({ id })).catch((error) => {
    if (isNotFound(error) || error?.code === "BAD_REQUEST") return null
    throw error
  })
  if (!item) notFound()
  const hotel = await call((api) => api.hotel.get())
  const date = (value: Date) => formatDate(value, locale, hotel.timezone)
  const ratings = [
    ["rooms", item.ratingRooms],
    ["cleanliness", item.ratingCleanliness],
    ["service", item.ratingService],
  ] as const

  return (
    <>
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/feedback" />}>{tNav("unhappyGuests")}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{item.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title={item.name}
        description={<Phone value={item.guest.phoneE164} />}
        action={
          <Button
            render={<a href={`tel:${item.guest.phoneE164}`} aria-label={t("callGuest", { name: item.name })} />}
            nativeButton={false}
          >
            <PhoneIcon data-icon="inline-start" />
            {t("call")}
          </Button>
        }
        secondaryActions={
          <>
            {item.guest.email ? (
              <Button variant="outline" render={<a href={`mailto:${item.guest.email}`} />} nativeButton={false}>
                <MailIcon data-icon="inline-start" />
                {t("email")}
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href={`/guests/${item.guest.id}`} />} nativeButton={false}>
              <UserRoundIcon data-icon="inline-start" />
              {t("profile")}
            </Button>
          </>
        }
      />
      <div className="grid gap-8 p-4 md:p-6 lg:grid-cols-2 lg:gap-14">
        <Section title={t("answer")}>
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <ScoreBadge nps={item.nps} />
              <CaseStatusBadge status={item.status} />
              <span className="ms-auto text-muted-foreground text-xs">{date(item.createdAt)}</span>
            </div>
            {item.comment ? (
              <blockquote dir="auto" className="border-s-2 ps-3 text-start text-base">
                {item.comment}
              </blockquote>
            ) : (
              <p className="text-muted-foreground">{t("noComment")}</p>
            )}
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              {ratings.map(([key, value]) =>
                value == null ? null : <span key={key}>{tDetail(`rating.${key}`, { value })}</span>,
              )}
            </p>
          </div>
        </Section>

        <Section
          title={t("followUp")}
          // The isolate marks keep a Latin name from reordering the Arabic sentence.
          description={
            item.handledBy
              ? t("handledBy", { name: `\u2068${item.handledBy}\u2069`, date: date(item.updatedAt) })
              : null
          }
        >
          <GiveOffer guestId={item.guest.id} guestName={item.name} className="w-full md:w-fit" />
          <FeedbackCaseForm
            key={item.updatedAt.toISOString()}
            id={item.id}
            status={item.status}
            notes={item.notes}
            updatedAt={item.updatedAt}
          />
        </Section>
      </div>
    </>
  )
}

// i18n-used: guests.detail.rating.rooms
// i18n-used: guests.detail.rating.cleanliness
// i18n-used: guests.detail.rating.service
