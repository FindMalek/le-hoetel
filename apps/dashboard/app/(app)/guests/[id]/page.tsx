import { hotelRoles } from "@le-hoetel/auth/access"
import { CONSENT_CHANNELS, type ConsentChannel, type ConsentSource } from "@le-hoetel/common/consent"
import { LOCALE_NAMES } from "@le-hoetel/i18n"
import { isNotFound } from "@le-hoetel/orpc/errors"
import { Badge } from "@le-hoetel/ui/components/badge"
import { EmptyState } from "@le-hoetel/ui/components/empty-state"
import { Section } from "@le-hoetel/ui/components/section"
import { MailIcon, MessageCircleIcon, MessagesSquareIcon, UserRoundCheckIcon } from "lucide-react"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { GuestActions } from "@/components/guest-actions"
import { WithdrawConsent } from "@/components/guest-consent-controls"
import { GuestsBreadcrumb } from "@/components/guests-breadcrumb"
import { LocalDate } from "@/components/local-date"
import { PageHeader } from "@/components/page-header"
import { call } from "@/lib/api"

const MESSAGE_STATUS_VARIANT = {
  queued: "outline",
  sent: "secondary",
  delivered: "default",
  failed: "destructive",
  skipped_no_consent: "outline",
} as const

const Ltr = ({ children }: { children: React.ReactNode }) => (
  <bdi dir="ltr" className="tabular-nums">
    {children}
  </bdi>
)

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
  const [events, sent] = await Promise.all([
    call((api) => api.guests.consentHistory({ id })),
    call((api) => api.guests.messages({ id })),
  ])
  const allowed = (guestPermission: "update" | "export" | "delete") =>
    role ? hotelRoles[role].authorize({ guest: [guestPermission] }).success : false

  const lastChange = (channel: ConsentChannel) => events.find((event) => event.channel === channel)
  const sourceLabel = (source: ConsentSource) =>
    source === "unsubscribe_link" || source === "stop_reply" || source === "guest_request"
      ? t(`sources.${source}`)
      : tGuests(`source.${source}`)

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: t("phone"), value: <Ltr>{guest.phoneE164}</Ltr> },
    {
      label: t("email"),
      value: guest.email ? <Ltr>{guest.email}</Ltr> : <span className="text-muted-foreground">{t("none")}</span>,
    },
    { label: t("language"), value: LOCALE_NAMES[guest.language] },
    { label: t("source"), value: tGuests(`source.${guest.source}`) },
    { label: t("added"), value: <LocalDate value={guest.createdAt} /> },
    ...(guest.birthday
      ? [{ label: t("birthday"), value: <time dateTime={guest.birthday}>{guest.birthday}</time> }]
      : []),
    ...(guest.country || guest.city
      ? [{ label: t("from"), value: [guest.city, guest.country].filter(Boolean).join(", ") }]
      : []),
    ...(guest.stayCheckIn
      ? [{ label: t("stay"), value: <Ltr>{`${guest.stayCheckIn} → ${guest.stayCheckOut ?? ""}`}</Ltr> }]
      : []),
    ...(guest.nextDestination ? [{ label: t("next"), value: guest.nextDestination }] : []),
  ]

  return (
    <>
      <PageHeader
        breadcrumb={<GuestsBreadcrumb current={guest.name} />}
        title={guest.name}
        description={t("subtitle", { language: LOCALE_NAMES[guest.language] })}
        actions={
          <GuestActions id={guest.id} name={guest.name} canExport={allowed("export")} canDelete={allowed("delete")} />
        }
      />
      <div className="grid gap-10 p-4 md:p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
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

        <div className="flex flex-col gap-10">
          <Section title={t("consents")} description={t("consentsHint")}>
            <ul className="flex flex-col divide-y rounded-lg border bg-card">
              {CONSENT_CHANNELS.map((channel) => {
                const granted = guest.consents[channel]
                const change = lastChange(channel)
                return (
                  <li key={channel} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-2 font-medium text-sm">
                        {channel === "email" ? (
                          <MailIcon className="size-4 text-muted-foreground" />
                        ) : channel === "whatsapp" ? (
                          <MessageCircleIcon className="size-4 text-muted-foreground" />
                        ) : (
                          <UserRoundCheckIcon className="size-4 text-muted-foreground" />
                        )}
                        {tGuests(`consent.${channel}`)}
                      </span>
                      {change && (
                        <span className="text-muted-foreground text-xs">
                          {t(granted ? "since" : "withdrawnOn")} <LocalDate value={change.at} />
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant={granted ? "secondary" : "outline"}>{t(granted ? "granted" : "notGranted")}</Badge>
                      {granted && allowed("update") && <WithdrawConsent guestId={guest.id} channel={channel} />}
                    </div>
                  </li>
                )
              })}
            </ul>
            {events.length > 0 && (
              <ol className="ms-2 flex flex-col gap-4 border-s ps-5">
                {events.map((event) => (
                  <li key={event.id} className="relative text-sm">
                    <span
                      aria-hidden
                      className={`-start-[26px] absolute top-1.5 size-2 rounded-full ${event.granted ? "bg-primary" : "bg-muted-foreground"}`}
                    />
                    <p className="font-medium">
                      {t(event.granted ? "eventGranted" : "eventWithdrawn", {
                        channel: tGuests(`consent.${event.channel}`),
                      })}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      <LocalDate value={event.at} time /> · {sourceLabel(event.source)} ·{" "}
                      {t("wording", { version: event.wordingVersion })}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title={t("messages")}>
            {sent.length ? (
              <ul className="flex flex-col divide-y rounded-lg border bg-card">
                {sent.map((message) => (
                  <li key={message.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 text-sm">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{tMessages(`channels.${message.channel}`)}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {message.templateKey} · <LocalDate value={message.createdAt} time />
                      </span>
                    </div>
                    <Badge variant={MESSAGE_STATUS_VARIANT[message.status]}>
                      {tMessages(`statuses.${message.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<MessagesSquareIcon />}
                title={t("noMessagesTitle")}
                description={t("noMessagesBody")}
              />
            )}
          </Section>
        </div>
      </div>
    </>
  )
}
