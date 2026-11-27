import { hotelRoles } from "@ritorno/auth/access"
import { CONSENT_CHANNELS, type ConsentChannel, type ConsentSource, consentWording } from "@ritorno/common/consent"
import { contactChannels } from "@ritorno/common/contact"
import { isSameLocalDay } from "@ritorno/common/hotel-time"
import { isWhatsappCapable } from "@ritorno/common/phone"
import type { GuestActivity } from "@ritorno/common/schemas"
import { LOCALE_NAMES } from "@ritorno/i18n"
import { isNotFound } from "@ritorno/orpc/errors"
import { Button } from "@ritorno/ui/components/button"
import { PageState } from "@ritorno/ui/components/page-state"
import { Section } from "@ritorno/ui/components/section"
import { StatusBadge, type StatusTone } from "@ritorno/ui/components/status-badge"
import {
  BedDoubleIcon,
  GiftIcon,
  MailIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  PencilIcon,
  StarIcon,
  UserRoundCheckIcon,
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ContactButtons } from "@/components/contact-buttons"
import { GiveOffer } from "@/components/give-offer"
import { GuestActions } from "@/components/guest-actions"
import { ConsentChange } from "@/components/guest-consent-controls"
import { ConsentBadges, GuestDate, Phone, ReturningBadge } from "@/components/guest-list"
import { GuestsBreadcrumb } from "@/components/guests-breadcrumb"
import { MarkVisitButton } from "@/components/mark-visit-button"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

const MESSAGE_STATUS_TONE: Record<string, StatusTone> = {
  queued: "neutral",
  sent: "info",
  delivered: "success",
  failed: "danger",
  skipped_no_consent: "warning",
  skipped_no_balance: "warning",
}

const CHANNEL_ICON = { email: MailIcon, whatsapp: MessageCircleIcon, profile: UserRoundCheckIcon } as const

const npsTone = (score: number): StatusTone => (score >= 9 ? "success" : score >= 7 ? "neutral" : "danger")

const Ltr = ({ children }: { children: React.ReactNode }) => (
  <bdi dir="ltr" className="tabular-nums">
    {children}
  </bdi>
)

function Rows({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col divide-y rounded-lg border bg-card">{children}</ul>
}

export default async function GuestPage({ params }: PageProps<"/guests/[id]">) {
  const { id } = await params
  const [t, tGuests, tMessages, { role }] = await Promise.all([
    getTranslations("guests.detail"),
    getTranslations("guests"),
    getTranslations("messages"),
    call((api) => api.hotel.mine()),
  ])
  const guest = await call((api) => api.guests.get({ id })).catch((error) => {
    if (isNotFound(error)) return null
    throw error
  })
  if (!guest) notFound()
  const [events, sent, activity, hotel] = await Promise.all([
    call((api) => api.guests.consentHistory({ id })),
    call((api) => api.guests.messages({ id })),
    call((api) => api.guests.activity({ id })),
    call((api) => api.hotel.get()),
  ])
  const allowed = (guestPermission: "create" | "update" | "export" | "delete") =>
    role ? hotelRoles[role].authorize({ guest: [guestPermission] }).success : false

  const [lastStay] = activity.stays
  const visitedToday = !!lastStay && isSameLocalDay(lastStay.at, new Date(), hotel.timezone)
  const lastChange = (channel: ConsentChannel) => events.find((event) => event.channel === channel)
  const sourceLabel = (source: ConsentSource) =>
    source === "unsubscribe_link" || source === "stop_reply" || source === "guest_request"
      ? t(`sources.${source}`)
      : tGuests(`source.${source}`)
  const canGrant = (channel: ConsentChannel) =>
    channel === "email" ? !!guest.email : channel === "whatsapp" ? isWhatsappCapable(guest.phoneE164) : true

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("phone"), value: <Phone value={guest.phoneE164} /> },
    {
      label: t("email"),
      value: guest.email ? <Ltr>{guest.email}</Ltr> : <span className="text-muted-foreground">{t("none")}</span>,
    },
    { label: t("language"), value: LOCALE_NAMES[guest.language] },
    {
      label: t("birthday"),
      value: guest.birthday ? (
        <GuestDate value={guest.birthday} />
      ) : (
        <span className="text-muted-foreground">{t("none")}</span>
      ),
    },
    { label: t("source"), value: tGuests(`source.${guest.source}`) },
    { label: t("added"), value: <GuestDate value={guest.createdAt} /> },
    ...(guest.country || guest.city
      ? [{ label: t("from"), value: [guest.city, guest.country].filter(Boolean).join(", ") }]
      : []),
    ...(guest.stayCheckIn
      ? [{ label: t("stay"), value: <GuestDate value={guest.stayCheckIn} to={guest.stayCheckOut ?? undefined} /> }]
      : guest.stayCheckOut
        ? [{ label: t("checkOut"), value: <GuestDate value={guest.stayCheckOut} /> }]
        : []),
    ...(guest.nextDestination ? [{ label: t("next"), value: guest.nextDestination }] : []),
  ]

  return (
    <>
      <PageHeader
        breadcrumb={<GuestsBreadcrumb current={guest.name} />}
        title={guest.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Phone value={guest.phoneE164} />
            <span aria-hidden>·</span>
            {LOCALE_NAMES[guest.language]}
          </span>
        }
        action={
          <>
            <ContactButtons name={guest.name} phoneE164={guest.phoneE164} {...contactChannels(guest)} />
            {/* One unit, so "more" never wraps onto a line of its own. */}
            <div className="flex gap-2 *:first:max-md:grow">
              {allowed("update") && (
                <Button variant="outline" render={<Link href={`/guests/${guest.id}/edit`} />} nativeButton={false}>
                  <PencilIcon data-icon="inline-start" />
                  {t("edit")}
                </Button>
              )}
              <GuestActions
                menu
                id={guest.id}
                name={guest.name}
                canExport={allowed("export")}
                canDelete={allowed("delete")}
              />
            </div>
          </>
        }
      />
      <div className="flex flex-col gap-8 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {activity.stays.length >= 2 ? (
            <ReturningBadge visits={activity.stays.length} />
          ) : (
            <StatusBadge tone="neutral" icon={<BedDoubleIcon />}>
              {t("firstStay")}
            </StatusBadge>
          )}
          <ConsentBadges consents={guest.consents} />
          <div className="flex w-full flex-col gap-2 sm:ms-auto sm:w-auto sm:flex-row">
            {allowed("create") && (
              <MarkVisitButton guestId={guest.id} visitedToday={visitedToday} className="w-full sm:w-auto" />
            )}
            <GiveOffer guestId={guest.id} guestName={guest.name} className="w-full sm:w-auto" />
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
          <div className="flex flex-col gap-10">
            <Section title={t("contact")}>
              <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-3 text-sm">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className="col-span-2 grid grid-cols-subgrid items-baseline border-b pb-3 last:border-b-0"
                  >
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 break-words font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title={t("stays")}>
              {activity.stays.length ? (
                <Rows>
                  {activity.stays.map((stay) => (
                    <li key={stay.id} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
                      <span className="font-medium">
                        <GuestDate value={stay.at} />
                      </span>
                      <span className="text-muted-foreground">{tGuests(`source.${stay.source}`)}</span>
                    </li>
                  ))}
                </Rows>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noStays")}</p>
              )}
            </Section>

            <Section title={t("offers")}>
              {activity.offers.length ? (
                <Rows>
                  {activity.offers.map((offer) => (
                    <li key={offer.id} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
                      <GiftIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{offer.title}</span>
                      <span className="shrink-0 text-muted-foreground">
                        <GuestDate value={offer.at} />
                      </span>
                    </li>
                  ))}
                </Rows>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noOffers")}</p>
              )}
            </Section>
          </div>

          <div className="flex flex-col gap-10">
            <Section title={t("consents")} description={t("consentsHint")}>
              <Rows>
                {CONSENT_CHANNELS.map((channel) => {
                  const granted = guest.consents[channel]
                  const change = lastChange(channel)
                  const Icon = CHANNEL_ICON[channel]
                  return (
                    <li key={channel} className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex min-w-32 flex-1 flex-col gap-1">
                        <span className="flex items-center gap-2 font-medium text-sm">
                          <Icon className="size-4 text-muted-foreground" aria-hidden />
                          {tGuests(`consent.${channel}`)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {change ? (
                            <>
                              {t(granted ? "since" : "withdrawnOn")} <GuestDate value={change.at} />
                            </>
                          ) : (
                            t("neverAsked")
                          )}
                        </span>
                      </div>
                      <div className="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <StatusBadge tone={granted ? "success" : "neutral"}>
                          {t(granted ? "granted" : "notGranted")}
                        </StatusBadge>
                        {allowed("update") && (
                          <ConsentChange
                            guestId={guest.id}
                            channel={channel}
                            granted={granted}
                            wording={
                              canGrant(channel) ? consentWording(channel, guest.language, hotel.displayName) : undefined
                            }
                          />
                        )}
                      </div>
                    </li>
                  )
                })}
              </Rows>
              {events.length > 0 && (
                <details className="group rounded-lg border bg-card">
                  <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium text-sm">
                    {t("history", { count: events.length })}
                  </summary>
                  <ol className="ms-6 me-4 mb-4 flex flex-col gap-4 border-s ps-5">
                    {events.map((event) => (
                      <li key={event.id} className="relative text-sm">
                        <span
                          aria-hidden
                          className={`-start-6.5 absolute top-1.5 size-2 rounded-full ${event.granted ? "bg-success" : "bg-muted-foreground"}`}
                        />
                        <p className="font-medium">
                          {t(event.granted ? "eventGranted" : "eventWithdrawn", {
                            channel: tGuests(`consent.${event.channel}`),
                          })}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          <GuestDate value={event.at} time /> · {sourceLabel(event.source)} ·{" "}
                          {t("wording", { version: event.wordingVersion })}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </Section>

            <Section title={t("surveys")}>
              {activity.surveys.length ? (
                <Rows>
                  {activity.surveys.map((survey) => (
                    <SurveyRow key={survey.id} survey={survey} t={t} />
                  ))}
                </Rows>
              ) : (
                <p className="text-muted-foreground text-sm">{t("noSurveys")}</p>
              )}
            </Section>

            <Section title={t("messages")}>
              {sent.length ? (
                <Rows>
                  {sent.map((message) => (
                    <li key={message.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 text-sm">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{tMessages(`channels.${message.channel}`)}</span>
                        <span className="truncate text-muted-foreground text-xs">
                          {message.templateKey} · <GuestDate value={message.createdAt} time />
                        </span>
                      </div>
                      <StatusBadge tone={MESSAGE_STATUS_TONE[message.status] ?? "neutral"}>
                        {tMessages(`statuses.${message.status}`)}
                      </StatusBadge>
                    </li>
                  ))}
                </Rows>
              ) : (
                <PageState
                  kind="empty"
                  icon={<MessagesSquareIcon />}
                  title={t("noMessagesTitle")}
                  description={t("noMessagesBody")}
                />
              )}
            </Section>
          </div>
        </div>
      </div>
    </>
  )
}

function SurveyRow({
  survey,
  t,
}: {
  survey: GuestActivity["surveys"][number]
  t: Awaited<ReturnType<typeof getTranslations<"guests.detail">>>
}) {
  const ratings = [
    ["rooms", survey.ratingRooms],
    ["cleanliness", survey.ratingCleanliness],
    ["service", survey.ratingService],
  ] as const
  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge tone={npsTone(survey.nps)} icon={<StarIcon />}>
          {t("nps", { score: survey.nps })}
        </StatusBadge>
        <span className="text-muted-foreground text-xs">
          <GuestDate value={survey.at} />
        </span>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {ratings.map(([key, value]) => (value == null ? null : <span key={key}>{t(`rating.${key}`, { value })}</span>))}
      </p>
      {survey.comment ? (
        <blockquote dir="auto" className="border-s-2 ps-3">
          {survey.comment}
        </blockquote>
      ) : null}
    </li>
  )
}

// i18n-used: guests.detail.granted
// i18n-used: guests.detail.notGranted
// i18n-used: guests.detail.since
// i18n-used: guests.detail.withdrawnOn
// i18n-used: guests.detail.eventGranted
// i18n-used: guests.detail.eventWithdrawn
// i18n-used: guests.detail.rating.rooms
// i18n-used: guests.detail.rating.cleanliness
// i18n-used: guests.detail.rating.service
